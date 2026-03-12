import httpx
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def send_discord_alert(webhook_url: str, ticker: str, jump_pct: float, low_price: float, current_price: float):
    """Send a rich embed alert to a Discord webhook."""
    if not webhook_url:
        logger.warning("Discord webhook URL not configured, skipping notification")
        return False

    now = datetime.now(timezone.utc)

    embed = {
        "embeds": [
            {
                "title": f"🚀 MOMENTUM ALERT — ${ticker}",
                "color": 0x00FF88,  # Bright green
                "fields": [
                    {
                        "name": "📈 Jump",
                        "value": f"**+{jump_pct:.2f}%**",
                        "inline": True,
                    },
                    {
                        "name": "💰 Current Price",
                        "value": f"**${current_price:.4f}**",
                        "inline": True,
                    },
                    {
                        "name": "📉 Window Low",
                        "value": f"${low_price:.4f}",
                        "inline": True,
                    },
                ],
                "footer": {
                    "text": "Stock Momentum Scanner"
                },
                "timestamp": now.isoformat(),
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook_url, json=embed)
            if response.status_code in (200, 204):
                logger.info(f"Discord alert sent for {ticker} (+{jump_pct:.2f}%)")
                return True
            else:
                logger.error(f"Discord webhook failed: {response.status_code} — {response.text}")
                return False
    except Exception as e:
        logger.error(f"Discord webhook error: {e}")
        return False
