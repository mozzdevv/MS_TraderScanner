"use client";

import { useState } from "react";

export default function EngineStatus({ isRunning }) {
  const [loading, setLoading] = useState(false);

  const toggleEngine = async () => {
    setLoading(true);
    try {
      const endpoint = isRunning ? "stop" : "start";
      await fetch(`/api/engine/${endpoint}`, { method: "POST" });
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className={`badge ${isRunning ? "live" : "offline"}`}>
        <div className="dot" />
        {isRunning ? "Engine Active" : "Engine Paused"}
      </div>
      
      <button 
        className={isRunning ? "btn-secondary" : "btn-primary"} 
        onClick={toggleEngine}
        disabled={loading}
      >
        {loading ? "..." : (isRunning ? "Pause" : "Start Engine")}
      </button>
    </div>
  );
}
