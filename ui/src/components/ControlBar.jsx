import { useState, useEffect } from 'react';
import { apiPost } from '../hooks/useWebSocket.js';
import styles from './ControlBar.module.css';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8008';

export default function ControlBar({ simState, connected }) {
  const [running,    setRunning]    = useState(true);
  const [rlOn,       setRlOn]       = useState(true);
  const [rlMode,     setRlMode]     = useState('simulated');
  const [apiKeySet,  setApiKeySet]  = useState(false);
  const [speed,      setSpeed]      = useState(1.5);
  const [modeError,  setModeError]  = useState('');

  // Sync rl mode + api_key_set from live sim state
  useEffect(() => {
    if (simState?.rl) {
      setRlMode(simState.rl.mode || 'simulated');
      setApiKeySet(simState.rl.api_key_set || false);
    }
  }, [simState?.rl?.mode, simState?.rl?.api_key_set]);

  async function togglePause() {
    await apiPost('/pause');
    setRunning(r => !r);
  }

  async function handleReset() {
    await apiPost('/reset');
    setRunning(true);
    setModeError('');
  }

  async function handleObstacle() {
    const col = 5 + Math.floor(Math.random() * 22);
    const row = 5 + Math.floor(Math.random() * 18);
    await apiPost('/obstacle', { col, row, width: 3, height: 3 });
  }

  async function handleToggleRL() {
    await apiPost('/rl/toggle');
    setRlOn(v => !v);
  }

  async function handleFault() {
    await apiPost('/fault');
  }

  async function handleSpeedChange(v) {
    const val = parseFloat(v);
    setSpeed(val);
    await apiPost(`/speed/${val}`);
  }

  async function handleRLModeToggle() {
    const next = rlMode === 'simulated' ? 'nebius' : 'simulated';
    setModeError('');
    try {
      const res = await fetch(`${API_BASE}/rl/mode`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode: next }),
      });
      const data = await res.json();
      if (data.ok) {
        setRlMode(data.mode);
      } else {
        setModeError(data.error || 'Failed to switch mode');
      }
    } catch (e) {
      setModeError('Cannot reach backend');
    }
  }

  const fsmState = simState?.fsm_state || 'IDLE';
  const simTime  = simState?.sim_time  || 0;
  const isNebius = rlMode === 'nebius';

  return (
    <div className={styles.wrap}>
      {modeError && (
        <div className={styles.errorBanner}>
          {modeError} — add NEBIUS_API_KEY to backend/.env and restart
        </div>
      )}
      <div className={styles.bar}>
        <div className={styles.left}>
          <button
            className={`${styles.btn} ${running ? styles.active : ''}`}
            onClick={togglePause} disabled={!connected}
          >
            {running ? '⏸ Pause' : '▶ Run'}
          </button>
          <button className={styles.btn} onClick={handleReset} disabled={!connected}>
            ↺ Reset
          </button>
          <button className={styles.btn} onClick={handleObstacle} disabled={!connected}>
            + Obstacle
          </button>
          <button
            className={`${styles.btn} ${rlOn ? styles.rlOn : ''}`}
            onClick={handleToggleRL} disabled={!connected}
          >
            RL: {rlOn ? 'ON' : 'OFF'}
          </button>
          <button
            className={`${styles.btn} ${styles.fault}`}
            onClick={handleFault} disabled={!connected}
          >
            Inject fault
          </button>
        </div>

        {/* ── RL MODE TOGGLE ── */}
        <div className={styles.modeToggle}>
          <span className={styles.modeLabel}>RL policy</span>
          <button
            className={`${styles.modeBtn} ${!isNebius ? styles.modeBtnActive : ''}`}
            onClick={() => rlMode !== 'simulated' && handleRLModeToggle()}
            disabled={!connected}
            title="Rule-based simulated agent (always available)"
          >
            Simulated
          </button>
          <button
            className={`${styles.modeBtn} ${isNebius ? styles.modeBtnNebius : ''} ${!apiKeySet ? styles.modeBtnDisabled : ''}`}
            onClick={() => rlMode !== 'nebius' && handleRLModeToggle()}
            disabled={!connected}
            title={apiKeySet
              ? 'Nebius LLM policy via token factory'
              : 'Set NEBIUS_API_KEY in backend/.env to enable'}
          >
            Nebius LLM
            {!apiKeySet && <span className={styles.lockIcon}>🔒</span>}
            {isNebius && apiKeySet && <span className={styles.liveTag}>LIVE</span>}
          </button>
        </div>

        <div className={styles.right}>
          <span className={styles.fsmPill} data-state={fsmState}>{fsmState}</span>
          <span className={styles.timerLabel}>t:{simTime}</span>
          <span className={styles.connDot} data-connected={connected} />
          <label className={styles.speedLabel}>Speed</label>
          <input
            type="range" min="0.5" max="4" step="0.5"
            value={speed}
            onChange={e => handleSpeedChange(e.target.value)}
            className={styles.slider}
            disabled={!connected}
          />
          <span className={styles.speedVal}>{speed.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
