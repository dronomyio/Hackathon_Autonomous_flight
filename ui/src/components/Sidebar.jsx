import { useEffect, useRef } from 'react';
import styles from './Sidebar.module.css';

const FSM_STATES = ['IDLE','TAKEOFF','NAVIGATING','AVOIDING','RL_CORRECT','REPLAN','LAND','FAULT'];
const FSM_STYLE  = {
  IDLE:       { bg:'#F1EFE8', fg:'#2C2C2A', border:'#5F5E5A' },
  TAKEOFF:    { bg:'#E6F1FB', fg:'#0C447C', border:'#185FA5' },
  NAVIGATING: { bg:'#E1F5EE', fg:'#085041', border:'#0F6E56' },
  AVOIDING:   { bg:'#FAEEDA', fg:'#633806', border:'#854F0B' },
  RL_CORRECT: { bg:'#EEEDFE', fg:'#3C3489', border:'#534AB7' },
  REPLAN:     { bg:'#FBEAF0', fg:'#72243E', border:'#993556' },
  LAND:       { bg:'#EAF3DE', fg:'#27500A', border:'#3B6D11' },
  FAULT:      { bg:'#FCEBEB', fg:'#791F1F', border:'#A32D2D' },
};

function Bar({ value, color, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={styles.barTrack}>
      <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function MetricRow({ label, value, color }) {
  return (
    <div className={styles.mRow}>
      <span className={styles.mLabel}>{label}</span>
      <span className={styles.mVal} style={color ? { color } : {}}>{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

export default function Sidebar({ simState, connected, error }) {
  const logRef         = useRef(null);
  const logEntriesRef  = useRef([]);

  useEffect(() => {
    if (!simState?.events?.length) return;
    simState.events.forEach(ev => logEntriesRef.current.push(ev));
    if (logEntriesRef.current.length > 120)
      logEntriesRef.current = logEntriesRef.current.slice(-120);
    if (logRef.current) {
      logRef.current.innerHTML = logEntriesRef.current
        .map(e => `<div class="log-entry log-${e.kind}">[${e.t}] ${e.msg}</div>`)
        .join('');
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [simState]);

  if (!simState) {
    return (
      <div className={styles.sidebar}>
        <div className={styles.connecting}>
          {error
            ? `Backend unreachable — ${error}`
            : connected
              ? 'Connected — waiting for first frame...'
              : 'Connecting to ws://localhost:8000/ws ...'}
        </div>
      </div>
    );
  }

  const { fsm_state, ekf, slam, planning, rl, drone } = simState;
  const s   = FSM_STYLE[fsm_state] || FSM_STYLE.IDLE;
  const posErr = Math.hypot(drone.x - ekf.x, drone.y - ekf.y);

  return (
    <div className={styles.sidebar}>
      <Section title="Flight state machine">
        <div className={styles.fsmGrid}>
          {FSM_STATES.map(st => {
            const active = st === fsm_state;
            const c = FSM_STYLE[st];
            return (
              <div key={st} className={styles.fsmState} style={active ? {
                background: c.bg, color: c.fg, borderColor: c.border,
                borderWidth: '1.5px', fontWeight: 500,
              } : {}}>
                {st}
              </div>
            );
          })}
        </div>
        <div className={styles.fsmCurrent} style={{ color: s.border }}>
          Active: {fsm_state}
        </div>
      </Section>

      <Section title="EKF estimator">
        <MetricRow label="Position error" value={`${posErr.toFixed(1)} m`} color="#185FA5" />
        <Bar value={posErr} color="#185FA5" max={30} />
        <MetricRow label="Velocity" value={`(${drone.vx.toFixed(1)}, ${drone.vy.toFixed(1)})`} />
        <MetricRow label="Innovation" value={ekf.innovation.toFixed(2)}
          color={ekf.innovation > 2 ? '#A32D2D' : ekf.innovation > 0.5 ? '#854F0B' : '#0F6E56'} />
        <MetricRow label="Cov trace P" value={ekf.P_trace.toFixed(2)} color="#534AB7" />
        <Bar value={ekf.P_trace} color="#534AB7" max={10} />
        <MetricRow label="IMU bias" value={ekf.bias.toFixed(3)} color="#854F0B" />
      </Section>

      <Section title="SLAM">
        <MetricRow label="Mapped" value={`${slam.mapped_pct}%`} color="#185FA5" />
        <Bar value={slam.mapped_pct} color="#185FA5" />
        <MetricRow label="Confidence" value={`${slam.confidence}%`}
          color={slam.confidence > 80 ? '#0F6E56' : slam.confidence > 60 ? '#854F0B' : '#A32D2D'} />
        <MetricRow label="Loop closures" value={slam.loop_closures} />
      </Section>

      <Section title="Planning + RL">
        <MetricRow label="Path nodes"    value={planning.path_nodes || '—'} />
        <MetricRow label="Obs avoided"   value={planning.obs_avoided} color="#854F0B" />
        <MetricRow label="RL reward"     value={rl.reward.toFixed(2)} color="#0F6E56" />
        <MetricRow label="RL corrections" value={rl.corrections} color="#854F0B" />
        <MetricRow label="Q-value"       value={rl.q_value.toFixed(2)} color="#534AB7" />
        <Bar value={rl.q_value} color="#534AB7" max={1} />
      </Section>

      <div className={styles.log} ref={logRef} />
    </div>
  );
}
