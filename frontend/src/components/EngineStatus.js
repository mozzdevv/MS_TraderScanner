"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function EngineStatus({ isRunning, tickersTracked }) {
  const [loading, setLoading] = useState(false);

  const toggleEngine = async () => {
    setLoading(true);
    try {
      const endpoint = isRunning ? "stop" : "start";
      await fetch(`${API_URL}/api/engine/${endpoint}`, { method: "POST" });
    } catch (err) {
      console.error("Failed to toggle engine:", err);
    }
    setLoading(false);
  };

  return (
    <div className="engine-controls">
      <div className={`engine-badge ${isRunning ? "running" : "stopped"}`}>
        <span className="engine-dot" />
        {isRunning ? "Running" : "Stopped"}
      </div>
      {isRunning && tickersTracked > 0 && (
        <span className="engine-meta">
          {tickersTracked} ticker{tickersTracked !== 1 ? "s" : ""}
        </span>
      )}
      <button
        className={`btn btn-sm ${isRunning ? "btn-danger" : "btn-primary"}`}
        onClick={toggleEngine}
        disabled={loading}
        id="toggle-engine-btn"
      >
        {loading ? "…" : isRunning ? "Stop" : "Start"}
      </button>
    </div>
  );
}
