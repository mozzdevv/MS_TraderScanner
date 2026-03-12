import asyncio
import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

import yfinance as yf

from database import get_watchlist, get_settings, save_alert
from discord_notifier import send_discord_alert

logger = logging.getLogger(__name__)


class PollingEngine:
    def __init__(self, broadcast_callback=None):
        self.running = False
        self._task = None
        # Rolling price windows: {ticker: deque[(timestamp, price)]}
        self._windows = defaultdict(deque)
        # Callback to broadcast alerts to WebSocket clients
        self._broadcast = broadcast_callback

    @property
    def is_running(self):
        return self.running

    def start(self):
        if self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("Polling engine started")

    def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("Polling engine stopped")

    def clear_window(self, ticker: str):
        """Clear the rolling window for a specific ticker."""
        if ticker in self._windows:
            self._windows[ticker].clear()

    def get_window_data(self):
        """Return current window data for all tickers."""
        result = {}
        for ticker, window in self._windows.items():
            if window:
                prices = [p for _, p in window]
                result[ticker] = {
                    "current": prices[-1] if prices else None,
                    "low": min(prices) if prices else None,
                    "high": max(prices) if prices else None,
                    "points": len(prices),
                }
        return result

    async def _poll_loop(self):
        logger.info("Poll loop starting...")
        while self.running:
            try:
                settings = await get_settings()
                if not settings:
                    await asyncio.sleep(5)
                    continue

                time_window = settings["time_window"]
                jump_threshold = settings["jump_threshold"] / 100.0
                poll_interval = settings.get("poll_interval", 7)
                webhook_url = settings.get("discord_webhook_url", "")

                watchlist = await get_watchlist()
                tickers = [item["ticker"] for item in watchlist]

                if not tickers:
                    logger.debug("Watchlist empty, sleeping...")
                    await asyncio.sleep(poll_interval)
                    continue

                # Fetch current prices
                prices = await self._fetch_prices(tickers)

                now = time.time()

                for ticker in tickers:
                    price = prices.get(ticker)
                    if price is None or price <= 0:
                        continue

                    # Add to rolling window
                    self._windows[ticker].append((now, price))

                    # Evict stale entries
                    while self._windows[ticker] and (now - self._windows[ticker][0][0]) > time_window:
                        self._windows[ticker].popleft()

                    # Need at least 2 data points
                    if len(self._windows[ticker]) < 2:
                        continue

                    # Find lowest price in window
                    window_prices = [p for _, p in self._windows[ticker]]
                    lowest = min(window_prices)

                    if lowest <= 0:
                        continue

                    jump_pct = (price - lowest) / lowest

                    if jump_pct >= jump_threshold:
                        jump_pct_display = round(jump_pct * 100, 2)
                        logger.info(
                            f"🚀 ALERT: {ticker} jumped {jump_pct_display}% "
                            f"(low: ${lowest:.4f} → current: ${price:.4f})"
                        )

                        # Save alert to DB
                        await save_alert(ticker, jump_pct_display, lowest, price)

                        # Send Discord notification
                        await send_discord_alert(webhook_url, ticker, jump_pct_display, lowest, price)

                        # Broadcast to WebSocket clients
                        if self._broadcast:
                            alert_data = {
                                "type": "alert",
                                "ticker": ticker,
                                "jump_pct": jump_pct_display,
                                "low_price": round(lowest, 4),
                                "current_price": round(price, 4),
                                "triggered_at": datetime.now(timezone.utc).isoformat(),
                            }
                            await self._broadcast(alert_data)

                        # Clear rolling window for this ticker to prevent duplicates
                        self.clear_window(ticker)

                # Broadcast status update
                if self._broadcast:
                    status_data = {
                        "type": "status",
                        "engine_running": True,
                        "tickers_tracked": len(tickers),
                        "window_data": self.get_window_data(),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    await self._broadcast(status_data)

                await asyncio.sleep(poll_interval)

            except asyncio.CancelledError:
                logger.info("Poll loop cancelled")
                break
            except Exception as e:
                logger.error(f"Poll loop error: {e}", exc_info=True)
                await asyncio.sleep(5)

    async def _fetch_prices(self, tickers: list) -> dict:
        """Fetch current prices for a list of tickers using yfinance."""
        prices = {}
        try:
            ticker_str = " ".join(tickers)
            loop = asyncio.get_event_loop()
            # yfinance is synchronous, run in executor
            data = await loop.run_in_executor(None, self._sync_fetch, tickers)
            prices.update(data)
        except Exception as e:
            logger.error(f"Price fetch error: {e}")
        return prices

    def _sync_fetch(self, tickers: list) -> dict:
        """Synchronous yfinance fetch wrapper."""
        prices = {}
        try:
            if len(tickers) == 1:
                t = yf.Ticker(tickers[0])
                info = t.fast_info
                price = getattr(info, "last_price", None)
                if price is None:
                    # Fallback: get from history
                    hist = t.history(period="1d", interval="1m")
                    if not hist.empty:
                        price = float(hist["Close"].iloc[-1])
                if price:
                    prices[tickers[0]] = float(price)
            else:
                # Batch download for multiple tickers
                data = yf.download(
                    tickers,
                    period="1d",
                    interval="1m",
                    progress=False,
                    threads=True,
                )
                if not data.empty:
                    if len(tickers) == 1:
                        last_close = data["Close"].iloc[-1]
                        prices[tickers[0]] = float(last_close)
                    else:
                        for ticker in tickers:
                            try:
                                if ticker in data["Close"].columns:
                                    val = data["Close"][ticker].iloc[-1]
                                    if val and not (val != val):  # Check NaN
                                        prices[ticker] = float(val)
                            except (KeyError, IndexError):
                                continue
        except Exception as e:
            logger.error(f"yfinance sync fetch error: {e}")

        return prices
