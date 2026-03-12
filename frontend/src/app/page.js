"use client";

import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../components/useWebSocket";
import { getApiBase } from "../components/api";
import WatchlistManager from "../components/WatchlistManager";
import SettingsPanel from "../components/SettingsPanel";
import AlertFeed from "../components/AlertFeed";
import EngineStatus from "../components/EngineStatus";

export default function Dashboard() {
  const { isConnected, alerts: wsAlerts, engineStatus } = useWebSocket();
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [engineRunning, setEngineRunning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Merge WebSocket alerts with DB alerts (deduplicated)
  const allAlerts = [...wsAlerts, ...alerts.filter(
    (dbAlert) => !wsAlerts.some(
      (wsAlert) => wsAlert.ticker === dbAlert.ticker && wsAlert.triggered_at === dbAlert.triggered_at
    )
  )];

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/watchlist`);
      if (res.ok) setWatchlist(await res.json());
    } catch (err) { console.error("fetchWatchlist:", err); }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/alerts`);
      if (res.ok) setAlerts(await res.json());
    } catch (err) { console.error("fetchAlerts:", err); }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/status`);
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
    const interval = setInterval(() => { fetchStatus(); fetchAlerts(); }, 15000);
    return () => clearInterval(interval);
  }, [fetchWatchlist, fetchAlerts, fetchStatus]);

  useEffect(() => {
    if (engineStatus) setEngineRunning(engineStatus.engine_running);
  }, [engineStatus]);

  const isRunning = engineStatus?.engine_running ?? engineRunning;
  const windowData = engineStatus?.window_data || {};

  return (
    <div className="app-container">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">≚</span>
          <span className="brand-name">Momentum Scanner</span>
        </div>
        
        <div className="header-actions">
          <div className={`badge ${isConnected ? "live" : "offline"}`} style={{ padding: "6px 12px", background: 'transparent', border: '1px solid var(--border-subtle)' }}>
            <div className="dot" />
            WS {isConnected ? "Live" : "Offline"}
          </div>
          <EngineStatus isRunning={isRunning} />
          
          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', margin: '0 8px' }} />
          
          <button className="btn-icon" onClick={() => setIsSettingsOpen(true)}>
            ⚙
          </button>
        </div>
      </header>

      {/* ── Main Dashboard ─────────────────────────────────────────── */}
      <main className="dashboard-main">
        {/* Left Column (Watchlist Full Height) */}
        <div style={{ height: 'calc(100vh - 100px)' }}>
          <WatchlistManager
            watchlist={watchlist}
            onRefresh={fetchWatchlist}
            windowData={windowData}
          />
        </div>

        {/* Right Column (Timeline Feed Full Height) */}
        <div style={{ height: 'calc(100vh - 100px)' }}>
          <AlertFeed alerts={allAlerts} />
        </div>
      </main>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
