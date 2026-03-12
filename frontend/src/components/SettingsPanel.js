"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SettingsPanel() {
  const [settings, setSettings] = useState({
    jump_threshold: 10,
    time_window: 60,
    poll_interval: 7,
    discord_webhook_url: "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      if (res.ok) setSettings(await res.json());
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
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
        const data = await res.json();
        setSettings(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <span className="icon">⚙️</span>
          Settings
        </span>
      </div>

      <div className="card-inner">
        <div className="settings-row">
          <div className="form-group">
            <label className="form-label" htmlFor="jump-threshold">Threshold (%)</label>
            <input
              id="jump-threshold"
              className="input"
              type="number"
              step="0.5"
              min="1"
              max="100"
              value={settings.jump_threshold}
              onChange={(e) =>
                setSettings({ ...settings, jump_threshold: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="time-window">Window (sec)</label>
            <input
              id="time-window"
              className="input"
              type="number"
              step="5"
              min="10"
              max="600"
              value={settings.time_window}
              onChange={(e) =>
                setSettings({ ...settings, time_window: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="poll-interval">Poll (sec)</label>
            <input
              id="poll-interval"
              className="input"
              type="number"
              step="1"
              min="3"
              max="30"
              value={settings.poll_interval}
              onChange={(e) =>
                setSettings({ ...settings, poll_interval: e.target.value })
              }
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label" htmlFor="webhook-url">Discord Webhook</label>
            <input
              id="webhook-url"
              className="input"
              type="url"
              placeholder="https://discord.com/api/webhooks/…"
              value={settings.discord_webhook_url}
              onChange={(e) =>
                setSettings({ ...settings, discord_webhook_url: e.target.value })
              }
            />
          </div>
        </div>

        <div className="settings-footer">
          <button
            className="btn btn-primary btn-sm"
            onClick={saveSettings}
            disabled={loading}
            id="save-settings-btn"
          >
            {loading ? "Saving…" : "Save Settings"}
          </button>
          {saved && <span className="settings-saved">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}
