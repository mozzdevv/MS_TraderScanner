import aiosqlite
import os
from datetime import datetime, timezone

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "scanner.db"))


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS watchlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT UNIQUE NOT NULL,
                added_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                jump_threshold REAL NOT NULL DEFAULT 10.0,
                time_window INTEGER NOT NULL DEFAULT 60,
                poll_interval INTEGER NOT NULL DEFAULT 7,
                discord_webhook_url TEXT DEFAULT ''
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                jump_pct REAL NOT NULL,
                low_price REAL NOT NULL,
                current_price REAL NOT NULL,
                triggered_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        # Ensure settings row always exists
        await db.execute("""
            INSERT OR IGNORE INTO settings (id, jump_threshold, time_window, poll_interval, discord_webhook_url)
            VALUES (1, 10.0, 60, 7, '')
        """)
        await db.commit()


async def get_watchlist():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM watchlist ORDER BY added_at DESC")
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def add_ticker(ticker: str):
    async with aiosqlite.connect(DB_PATH) as db:
        try:
            await db.execute(
                "INSERT INTO watchlist (ticker, added_at) VALUES (?, ?)",
                (ticker.upper(), datetime.now(timezone.utc).isoformat())
            )
            await db.commit()
            return True
        except aiosqlite.IntegrityError:
            return False


async def remove_ticker(ticker: str):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "DELETE FROM watchlist WHERE ticker = ?", (ticker.upper(),)
        )
        await db.commit()
        return cursor.rowcount > 0


async def get_settings():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM settings WHERE id = 1")
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_settings(jump_threshold=None, time_window=None, poll_interval=None, discord_webhook_url=None):
    updates = []
    values = []
    if jump_threshold is not None:
        updates.append("jump_threshold = ?")
        values.append(jump_threshold)
    if time_window is not None:
        updates.append("time_window = ?")
        values.append(time_window)
    if poll_interval is not None:
        updates.append("poll_interval = ?")
        values.append(poll_interval)
    if discord_webhook_url is not None:
        updates.append("discord_webhook_url = ?")
        values.append(discord_webhook_url)

    if not updates:
        return

    query = f"UPDATE settings SET {', '.join(updates)} WHERE id = 1"
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(query, values)
        await db.commit()


async def save_alert(ticker: str, jump_pct: float, low_price: float, current_price: float):
    async with aiosqlite.connect(DB_PATH) as db:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO alerts (ticker, jump_pct, low_price, current_price, triggered_at) VALUES (?, ?, ?, ?, ?)",
            (ticker, jump_pct, low_price, current_price, now)
        )
        await db.commit()


async def get_alerts(limit: int = 100):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM alerts ORDER BY triggered_at DESC LIMIT ?", (limit,)
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def clear_alerts():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM alerts")
        await db.commit()
