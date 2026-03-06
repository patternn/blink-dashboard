import { useState, useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type { Metrics, MetricsSnapshot, WsEvent, ApiResponse } from "../types";

const SOCKET_URL = import.meta.env.VITE_API_URL || "";
const RECONNECT_DELAY = 3000;
const POLL_INTERVAL = 10000; // fallback polling if WS fails

interface UseMetricsReturn {
  metrics: Metrics | null;
  history: MetricsSnapshot[];
  connected: boolean;
  lastUpdate: Date | null;
  error: string | null;
  refresh: () => void;
}

export function useMetrics(): UseMetricsReturn {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── REST fetch (initial load + fallback) ─────────────────

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics");
      const json: ApiResponse<Metrics> = await res.json();
      if (json.ok && json.data) {
        setMetrics(json.data);
        setLastUpdate(new Date(json.data.updatedAt));
        setError(null);
      }
    } catch (err) {
      setError("Failed to fetch metrics");
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics/history?count=60");
      const json: ApiResponse<MetricsSnapshot[]> = await res.json();
      if (json.ok && json.data) {
        setHistory(json.data);
      }
    } catch {
      // non-critical
    }
  }, []);

  const refresh = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("metrics:refresh");
    } else {
      fetchMetrics();
    }
    fetchHistory();
  }, [fetchMetrics, fetchHistory]);

  // ─── Socket.IO connection ─────────────────────────────────

  useEffect(() => {
    // Initial REST load
    fetchMetrics();
    fetchHistory();

    // Connect WebSocket
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError(null);

      // Stop polling if we were falling back
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);

      // Start fallback polling
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchMetrics, POLL_INTERVAL);
      }
    });

    socket.on("metrics:update", (event: WsEvent<Metrics>) => {
      setMetrics(event.data);
      setLastUpdate(new Date(event.timestamp));

      // Append to local history for sparklines
      setHistory((prev) => {
        const snapshot: MetricsSnapshot = {
          ...event.data,
          snapshotId: `ws_${Date.now()}`,
        };
        const next = [...prev, snapshot];
        // Keep last 120 snapshots in memory
        return next.length > 120 ? next.slice(-120) : next;
      });
    });

    socket.on("connect_error", () => {
      setError("WebSocket connection failed — using REST fallback");
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchMetrics, POLL_INTERVAL);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchMetrics, fetchHistory]);

  return { metrics, history, connected, lastUpdate, error, refresh };
}
