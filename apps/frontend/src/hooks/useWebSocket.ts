"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WsEvent } from "@talora/shared";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws";
const BASE_DELAY = 3000;
const MAX_DELAY = 30000;
const MAX_RETRIES = 10;

export function useWebSocket() {
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [retriesExhausted, setRetriesExhausted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const retryCount = useRef(0);

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    // Close any lingering socket before creating a new one
    wsRef.current?.close();

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      retryCount.current = 0;
      setRetriesExhausted(false);
      setIsConnected(true);
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as WsEvent;
        setLastEvent(data);
      } catch {
        // ignore non-json messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);

      if (retryCount.current >= MAX_RETRIES) {
        setRetriesExhausted(true);
        return;
      }

      const delay = Math.min(BASE_DELAY * Math.pow(2, retryCount.current), MAX_DELAY);
      const jitter = Math.random() * 1000;
      retryCount.current += 1;

      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, delay + jitter);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  // Manual reconnect: resets exhausted state and retry counter so the
  // exponential-backoff loop starts fresh.
  const reconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    retryCount.current = 0;
    setRetriesExhausted(false);
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastEvent, isConnected, retriesExhausted, reconnect };
}
