import { useCallback } from 'react';
import { useWebSocket, apiPost } from './hooks/useWebSocket.js';
import TopBar from './components/TopBar.jsx';
import WorldCanvas from './components/WorldCanvas.jsx';
import Sidebar from './components/Sidebar.jsx';
import ControlBar from './components/ControlBar.jsx';
import './App.css';

export default function App() {
  const { simState, connected, error } = useWebSocket();

  const handleCanvasClick = useCallback(async (col, row) => {
    await apiPost('/goal', { col, row });
  }, []);

  return (
    <div className="app-shell">
      <TopBar connected={connected} />

      <div className="app-body">
        <div className="canvas-area">
          {error && (
            <div style={{
              position: 'absolute', top: 48, left: 0, right: 300,
              background: 'rgba(163,45,45,0.15)',
              border: '0.5px solid rgba(163,45,45,0.4)',
              color: '#F09595', fontSize: 11, padding: '8px 14px',
              fontFamily: 'monospace', zIndex: 10
            }}>
              {error} — check backend container is running on port 8000
            </div>
          )}
          <WorldCanvas simState={simState} onCanvasClick={handleCanvasClick} />
          <ControlBar simState={simState} connected={connected} />
        </div>
        <Sidebar simState={simState} connected={connected} error={error} />
      </div>
    </div>
  );
}
