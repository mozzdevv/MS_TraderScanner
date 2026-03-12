"use client";

import { useState, useEffect } from "react";
import { getApiBase } from "./api";

export default function SettingsPanel({ isOpen, onClose }) {
  const [settings, setSettings] = useState({
    jump_threshold: 10,
    time_window: 60,
    poll_interval: 7,
    discord_webhook_url: "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) fetchSettings();
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/settings`);
      if (res.ok) setSettings(await res.json());
    } catch (err) { console.error("Failed to load settings:", err); }
  };

  const saveSettings = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch(`${getApiBase()}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jump_threshold: parseFloat(settings.jump_threshold),
          time_window: parseInt(settings.time_window),
          poll_interval: parseInt(settings.poll_interval),
          discord_webhook_url: settings.discord_webhook_url,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => { setSaved(false); onClose(); }, 750);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Settings</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Threshold (%)</label>
              <input
                className="form-input"
                type="number" step="0.5"
                value={settings.jump_threshold}
                onChange={(e) => setSettings({ ...settings, jump_threshold: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Window (sec)</label>
              <input
                className="form-input"
                type="number" step="5"
                value={settings.time_window}
                onChange={(e) => setSettings({ ...settings, time_window: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Poll Interval (sec)</label>
            <input
              className="form-input"
              type="number" step="1"
              value={settings.poll_interval}
              onChange={(e) => setSettings({ ...settings, poll_interval: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Discord Webhook</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              value={settings.discord_webhook_url}
              onChange={(e) => setSettings({ ...settings, discord_webhook_url: e.target.value })}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={saveSettings} disabled={loading}>
            {loading ? "..." : (saved ? "✓ Saved" : "Save Changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
