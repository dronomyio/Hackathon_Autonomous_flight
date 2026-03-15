import { useState } from 'react';
import { apiPost } from '../hooks/useWebSocket';
import styles from './ControlBar.module.css';

export default function ControlBar({ simState, connected }) {
  const [running, setRunning] = useState(true);
  const [rlOn, setRlOn] = useState(true);
  const [speed, setSpeed] = useState(1.5);
  const [statusMsg, setStatusMsg] = useState('Click map to set goal');

  async function togglePause() {
    await apiPost('/pause');
    setRunning(r => !r);
  }

  async function handleReset() {
    await apiPost('/reset');
    setRunning(true);
    setStatusMsg('Reset. Click map to set goal.');
  }

  async function handleObstacle() {
    const col = 5 + Math.floor(Math.random() * 22);
    const row = 5 + Math.floor(Math.random() * 18);
    await apiPost('/obstacle', { col, row, width: 3, height: 3 });
    setStatusMsg('Dynamic obstacle added');
  }

  async function handleToggleRL() {
    await apiPost('/rl/toggle');
    setRlOn(v => !v);
  }

  async function handleFault() {
    await apiPost('/fault');
    setStatusMsg('FAULT injected — watch EKF covariance spike');
  }

  async function handleSpeedChange(v) {
    const val = parseFloat(v);
    setSpeed(val);
    await apiPost(`/speed/${val}`);
  }

  const fsmState = simState?.fsm_state || 'IDLE';
  const simTime = simState?.sim_time || 0;

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <button
          className={`${styles.btn} ${running ? styles.active : ''}`}
          onClick={togglePause}
          disabled={!connected}
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
          onClick={handleToggleRL}
          disabled={!connected}
        >
          RL: {rlOn ? 'ON' : 'OFF'}
        </button>
        <button className={`${styles.btn} ${styles.fault}`} onClick={handleFault} disabled={!connected}>
          Inject fault
        </button>
      </div>

      <div className={styles.center}>
        <span className={styles.statusMsg}>{statusMsg}</span>
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
  );
}
