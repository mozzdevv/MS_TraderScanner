"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const RECONNECT_DELAY = 3000;

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [engineStatus, setEngineStatus] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const targetUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(targetUrl);

      ws.onopen = () => {
        setIsConnected(true);
        // Send pings every 30 seconds to keep alive
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          if (data.type === "alert") {
            setAlerts((prev) => [data, ...prev].slice(0, 200));
          } else if (data.type === "status") {
            setEngineStatus(data);
          }
        } catch (e) {
          // Ignore non-JSON messages (pong etc)
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        clearInterval(pingTimerRef.current);
        // Auto-reconnect
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch (e) {
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearInterval(pingTimerRef.current);
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, lastMessage, alerts, setAlerts, engineStatus };
}
