import { useEffect, useRef, useState, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws';

export function useWebSocket() {
  const [simState, setSimState] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < 2) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try { setSimState(JSON.parse(e.data)); } catch (_) {}
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { simState, connected };
}

export async function apiPost(path, body = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}
