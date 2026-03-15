import { useEffect, useRef, useState, useCallback } from 'react';

// VITE_ prefix required for Vite to expose env vars to the browser bundle.
// Falls back to localhost:8000 which is where Docker exposes the backend.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const WS_URL   = API_BASE.replace(/^https?/, (m) => m === 'https' ? 'wss' : 'ws') + '/ws';

console.log('[KR] API_BASE:', API_BASE);
console.log('[KR] WS_URL:  ', WS_URL);

export function useWebSocket() {
  const [simState, setSimState]   = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState(null);
  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const attempt        = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < 2) return;
    attempt.current += 1;
    console.log(`[KR] WS connect attempt #${attempt.current} → ${WS_URL}`);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[KR] WS connected');
      setConnected(true);
      setError(null);
      attempt.current = 0;
    };

    ws.onclose = (ev) => {
      console.warn('[KR] WS closed', ev.code, ev.reason);
      setConnected(false);
      // Exponential backoff, max 5s
      const delay = Math.min(500 * attempt.current, 5000);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = (ev) => {
      console.error('[KR] WS error', ev);
      setError('Cannot reach backend at ' + WS_URL);
      ws.close();
    };

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

  return { simState, connected, error };
}

export async function apiPost(path, body = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error('[KR] apiPost failed', path, e);
    return false;
  }
}
