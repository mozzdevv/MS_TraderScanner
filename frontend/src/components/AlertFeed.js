"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function formatTime(isoString) {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function formatDate(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function AlertFeed({ alerts, onClear }) {
  const clearAlerts = async () => {
    try {
      await fetch(`${API_URL}/api/alerts`, { method: "DELETE" });
      if (onClear) onClear();
    } catch (err) {
      console.error("Failed to clear alerts:", err);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <span className="icon">🚀</span>
          Alert Feed
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="card-meta">
            {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
          </span>
          {alerts.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={clearAlerts}
              id="clear-alerts-btn"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="alert-feed-wrapper">
        {alerts.length > 0 && (
          <div className="alert-table-head">
            <span>Ticker</span>
            <span>Jump</span>
            <span>Price</span>
            <span>Low</span>
            <span style={{ textAlign: "right" }}>Time</span>
          </div>
        )}

        <div className="alert-list">
          {alerts.length === 0 ? (
            <div className="alert-empty">
              <div className="alert-empty-icon">📊</div>
              <div className="alert-empty-title">No alerts yet</div>
              <div className="alert-empty-subtitle">
                Alerts appear here when a tracked stock jumps above your configured threshold within the time window.
              </div>
            </div>
          ) : (
            alerts.map((alert, i) => (
              <div key={`${alert.ticker}-${alert.triggered_at}-${i}`} className="alert-row">
                <span className="alert-ticker">{alert.ticker}</span>
                <span className="alert-jump">+{alert.jump_pct?.toFixed(2)}%</span>
                <span className="alert-price">${alert.current_price?.toFixed(4)}</span>
                <span className="alert-low">${alert.low_price?.toFixed(4)}</span>
                <span className="alert-time">
                  {formatDate(alert.triggered_at)} {formatTime(alert.triggered_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
