import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    init_db,
    get_watchlist,
    add_ticker,
    remove_ticker,
    get_settings,
    update_settings,
    get_alerts,
    clear_alerts,
)
from polling_engine import PollingEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── WebSocket connection manager ──────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)
        logger.info(f"WebSocket client connected ({len(self.connections)} total)")

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)
        logger.info(f"WebSocket client disconnected ({len(self.connections)} total)")

    async def broadcast(self, data: dict):
        message = json.dumps(data)
        disconnected = []
        for ws in self.connections:
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)


manager = ConnectionManager()

# ── Polling engine instance ──────────────────────────────────────────────

engine = PollingEngine(broadcast_callback=manager.broadcast)

# ── App lifespan ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Database initialized")
    # Auto-start the engine
    engine.start()
    yield
    engine.stop()
    logger.info("Shutdown complete")


app = FastAPI(title="Stock Momentum Scanner", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ─────────────────────────────────────────────────────

class TickerRequest(BaseModel):
    ticker: str

class SettingsUpdate(BaseModel):
    jump_threshold: Optional[float] = None
    time_window: Optional[int] = None
    poll_interval: Optional[int] = None
    discord_webhook_url: Optional[str] = None

# ── Watchlist endpoints ──────────────────────────────────────────────────

@app.get("/api/watchlist")
async def api_get_watchlist():
    return await get_watchlist()

@app.post("/api/watchlist")
async def api_add_ticker(req: TickerRequest):
    ticker = req.ticker.strip().upper()
    if not ticker:
        raise HTTPException(400, "Ticker cannot be empty")
    if len(ticker) > 10:
        raise HTTPException(400, "Invalid ticker symbol")
    success = await add_ticker(ticker)
    if not success:
        raise HTTPException(409, f"{ticker} is already on the watchlist")
    return {"message": f"{ticker} added to watchlist", "ticker": ticker}

@app.delete("/api/watchlist/{ticker}")
async def api_remove_ticker(ticker: str):
    ticker = ticker.strip().upper()
    success = await remove_ticker(ticker)
    if not success:
        raise HTTPException(404, f"{ticker} not found on watchlist")
    # Also clear rolling window
    engine.clear_window(ticker)
    return {"message": f"{ticker} removed from watchlist"}

# ── Settings endpoints ───────────────────────────────────────────────────

@app.get("/api/settings")
async def api_get_settings():
    settings = await get_settings()
    if not settings:
        raise HTTPException(500, "Settings not found")
    return settings

@app.put("/api/settings")
async def api_update_settings(req: SettingsUpdate):
    await update_settings(
        jump_threshold=req.jump_threshold,
        time_window=req.time_window,
        poll_interval=req.poll_interval,
        discord_webhook_url=req.discord_webhook_url,
    )
    return await get_settings()

# ── Alert endpoints ──────────────────────────────────────────────────────

@app.get("/api/alerts")
async def api_get_alerts(limit: int = 100):
    return await get_alerts(limit=limit)

@app.delete("/api/alerts")
async def api_clear_alerts():
    await clear_alerts()
    return {"message": "Alert history cleared"}

# ── Engine control endpoints ─────────────────────────────────────────────

@app.get("/api/status")
async def api_status():
    return {
        "engine_running": engine.is_running,
        "window_data": engine.get_window_data(),
    }

@app.post("/api/engine/start")
async def api_engine_start():
    engine.start()
    return {"message": "Polling engine started", "running": True}

@app.post("/api/engine/stop")
async def api_engine_stop():
    engine.stop()
    return {"message": "Polling engine stopped", "running": False}

# ── WebSocket endpoint ───────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Keep connection alive; client can send pings
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
