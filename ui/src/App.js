import { useCallback } from 'react';
import { useWebSocket, apiPost } from './hooks/useWebSocket';
import TopBar from './components/TopBar';
import WorldCanvas from './components/WorldCanvas';
import Sidebar from './components/Sidebar';
import ControlBar from './components/ControlBar';
import './App.css';

export default function App() {
  const { simState, connected } = useWebSocket();

  const handleCanvasClick = useCallback(async (col, row) => {
    await apiPost('/goal', { col, row });
  }, []);

  return (
    <div className="app-shell">
      <TopBar connected={connected} />

      <div className="app-body">
        <div className="canvas-area">
          <WorldCanvas simState={simState} onCanvasClick={handleCanvasClick} />
          <ControlBar simState={simState} connected={connected} />
        </div>
        <Sidebar simState={simState} />
      </div>
    </div>
  );
}
