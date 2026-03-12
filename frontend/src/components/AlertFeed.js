"use client";

function formatTimeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AlertFeed({ alerts }) {
  return (
    <div className="card">
      <div className="card-title">
        <span>Momentum Alerts</span>
        <span className="card-count">{alerts.length} Total</span>
      </div>

      <div className="timeline-container">
        {alerts.length === 0 ? (
          <div className="timeline-empty">
            <div style={{ fontSize: '2rem', opacity: 0.2, marginBottom: 12 }}>📡</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)' }}>Scanning for bursts...</div>
            <div style={{ fontSize: '0.85rem', marginTop: 8, maxWidth: 280 }}>
              Alerts will appear here when tracked stocks rapidly jump from their window lows.
            </div>
          </div>
        ) : (
          alerts.map((alert, i) => (
            <div key={`${alert.ticker}-${alert.triggered_at}-${i}`} className="timeline-event">
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="tl-header">
                  <span className="tl-ticker">{alert.ticker}</span>
                  <span className="tl-time">{formatTimeAgo(alert.triggered_at)}</span>
                </div>
                <div className="tl-message">
                  Jumped <span className="tl-highlight">+{alert.jump_pct?.toFixed(2)}%</span> from 
                  a window low of <span className="tl-highlight">${alert.low_price?.toFixed(2)}</span> to 
                  reach <span className="tl-highlight">${alert.current_price?.toFixed(2)}</span>.
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
