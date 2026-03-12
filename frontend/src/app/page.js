"use client";

import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../components/useWebSocket";
import WatchlistManager from "../components/WatchlistManager";
import SettingsPanel from "../components/SettingsPanel";
import AlertFeed from "../components/AlertFeed";
import EngineStatus from "../components/EngineStatus";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Dashboard() {
  const { isConnected, alerts: wsAlerts, setAlerts: setWsAlerts, engineStatus } = useWebSocket();
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [engineRunning, setEngineRunning] = useState(false);

  // Merge WebSocket alerts with DB alerts (deduplicated)
  const allAlerts = [...wsAlerts, ...alerts.filter(
    (dbAlert) => !wsAlerts.some(
      (wsAlert) => wsAlert.ticker === dbAlert.ticker && wsAlert.triggered_at === dbAlert.triggered_at
    )
  )];

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/watchlist`);
      if (res.ok) setWatchlist(await res.json());
    } catch (err) { console.error("fetchWatchlist:", err); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts`);
      if (res.ok) setAlerts(await res.json());
    } catch (err) { console.error("fetchAlerts:", err); }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setEngineRunning(data.engine_running);
      }
    } catch (err) { console.error("fetchStatus:", err); }
  }, []);

  useEffect(() => {
    fetchWatchlist();
    fetchAlerts();
    fetchStatus();
    const interval = setInterval(() => { fetchStatus(); fetchAlerts(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchWatchlist, fetchAlerts, fetchStatus]);

  useEffect(() => {
    if (engineStatus) setEngineRunning(engineStatus.engine_running);
  }, [engineStatus]);

  const handleClearAlerts = () => { setAlerts([]); setWsAlerts([]); };

  const isRunning = engineStatus?.engine_running ?? engineRunning;
  const windowData = engineStatus?.window_data || {};
  const tickersTracked = engineStatus?.tickers_tracked || watchlist.length;

  return (
    <div className="app-container">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="app-header">
        <h1>
          <span style={{ fontSize: "1.15rem" }}>⚡</span>
          <span className="logo-text">Momentum Scanner</span>
        </h1>
        <div className="header-controls">
          <EngineStatus isRunning={isRunning} tickersTracked={tickersTracked} />
          <div className={`connection-badge ${isConnected ? "connected" : "disconnected"}`}>
            <span className="connection-dot" />
            {isConnected ? "Live" : "Offline"}
          </div>
        </div>
      </header>

      {/* ── Main grid ──────────────────────────────────────────────── */}
      <main className="dashboard-grid">
        {/* Left rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <WatchlistManager
            watchlist={watchlist}
            onRefresh={fetchWatchlist}
            windowData={windowData}
          />
          <SettingsPanel />
        </div>

        {/* Right content */}
        <AlertFeed alerts={allAlerts} onClear={handleClearAlerts} />
      </main>

      {/* ── Status bar ─────────────────────────────────────────────── */}
      <footer className="status-bar">
        <div className="status-info">
          <span className="status-item">
            <span className={`status-dot ${isConnected ? "ok" : "err"}`} />
            WS {isConnected ? "Connected" : "Disconnected"}
          </span>
          <span className="status-item">
            <span className={`status-dot ${isRunning ? "ok" : "err"}`} />
            Engine {isRunning ? "On" : "Off"}
          </span>
          <span className="status-item">
            {watchlist.length} tickers · {allAlerts.length} alerts
          </span>
        </div>
        <span>v1.0</span>
      </footer>
    </div>
  );
}
