"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function WatchlistManager({ watchlist, onRefresh, windowData }) {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addTicker = async (e) => {
    e.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol }),
      });
      if (res.ok) {
        setTicker("");
        onRefresh();
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to add ticker");
      }
    } catch (err) {
      setError("Connection failed");
    }
    setLoading(false);
  };

  const removeTicker = async (symbol) => {
    try {
      await fetch(`${API_URL}/api/watchlist/${symbol}`, { method: "DELETE" });
      onRefresh();
    } catch (err) {
      setError("Failed to remove ticker");
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <span className="icon">📡</span>
          Watchlist
        </span>
        <span className="card-meta">
          {watchlist.length} ticker{watchlist.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="card-inner">
        <form onSubmit={addTicker} className="input-row" style={{ marginBottom: 14 }}>
          <input
            className="input"
            type="text"
            placeholder="Enter ticker symbol…"
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value.toUpperCase());
              setError("");
            }}
            maxLength={10}
            disabled={loading}
            id="ticker-input"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !ticker.trim()}
            id="add-ticker-btn"
          >
            {loading ? "…" : "+ Add"}
          </button>
        </form>

        {error && (
          <div style={{
            color: "var(--red-500)",
            fontSize: "0.75rem",
            marginBottom: 12,
            padding: "7px 12px",
            background: "var(--red-dim)",
            borderRadius: "var(--r-xs)",
            border: "1px solid rgba(244,63,94,0.12)",
          }}>
            {error}
          </div>
        )}

        <div className="watchlist-items">
          {watchlist.length === 0 ? (
            <div className="watchlist-empty">
              <div className="watchlist-empty-icon">📋</div>
              <div className="watchlist-empty-title">No tickers tracked</div>
              <div className="watchlist-empty-subtitle">
                Add symbols above to start monitoring
              </div>
            </div>
          ) : (
            watchlist.map((item) => {
              const wd = windowData?.[item.ticker];
              return (
                <div key={item.ticker} className="watchlist-item">
                  <div className="watchlist-left">
                    <span className="watchlist-ticker">{item.ticker}</span>
                    <div className="watchlist-price-group">
                      {wd?.current ? (
                        <>
                          <span className="watchlist-price">
                            ${wd.current.toFixed(2)}
                          </span>
                          <span className="watchlist-range">
                            <span>L ${wd.low?.toFixed(2)}</span>
                            <span>H ${wd.high?.toFixed(2)}</span>
                          </span>
                        </>
                      ) : (
                        <span className="watchlist-price" style={{ color: "var(--text-400)" }}>
                          loading…
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn-icon"
                    onClick={() => removeTicker(item.ticker)}
                    title="Remove ticker"
                    id={`remove-${item.ticker}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
