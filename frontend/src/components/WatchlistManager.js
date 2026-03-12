"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function WatchlistManager({ watchlist, onRefresh, windowData }) {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);

  const addTicker = async (e) => {
    e.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol }),
      });
      if (res.ok) {
        setTicker("");
        onRefresh();
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const removeTicker = async (symbol) => {
    try {
      await fetch(`${API_URL}/api/watchlist/${symbol}`, { method: "DELETE" });
      onRefresh();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="card">
      <div className="card-title">
        <span>Watchlist</span>
        <span className="card-count">{watchlist.length} Tickers</span>
      </div>

      <form onSubmit={addTicker} className="wl-add">
        <input
          className="wl-input"
          type="text"
          placeholder="Add ticker..."
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          maxLength={10}
        />
        <button type="submit" className="wl-btn" disabled={loading || !ticker}>
          +
        </button>
      </form>

      <div className="watchlist-container">
        {watchlist.map((item) => {
          const wd = windowData?.[item.ticker];
          return (
            <div key={item.ticker} className="wl-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button 
                  className="wl-remove" 
                  onClick={() => removeTicker(item.ticker)}
                  title="Remove"
                >×</button>
                <div>
                  <div className="wl-ticker">{item.ticker}</div>
                  <div className="wl-company">Tracked</div>
                </div>
              </div>
              
              <div className="wl-price-box">
                <div className="wl-price">
                  {wd?.current ? `$${wd.current.toFixed(2)}` : "—"}
                </div>
                {wd?.current && (
                  <div className="wl-range">
                    L: ${wd.low?.toFixed(2)} &nbsp; H: ${wd.high?.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
