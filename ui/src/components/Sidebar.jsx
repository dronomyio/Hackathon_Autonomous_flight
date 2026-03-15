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

function NebиusPanel({ rl }) {
  const isNebius   = rl.mode === 'nebius';
  const hasKey     = rl.api_key_set;
  const hasSuccess = rl.call_count > 0;
  const hasErrors  = rl.call_errors > 0;

  if (!isNebius) return null;

  return (
    <div className={styles.nebiusPanel}>
      <div className={styles.nebiusHeader}>
        <div className={`${styles.nebPulse} ${hasSuccess ? styles.nebPulseAlive : styles.nebPulseDead}`} />
        <span className={styles.nebiusTitle}>Nebius LLM policy</span>
        {hasSuccess && <span className={styles.liveTag}>LIVE</span>}
        {!hasKey    && <span className={styles.warnTag}>NO KEY</span>}
      </div>

      <div className={styles.nebiusModel}>{rl.model || '—'}</div>

      <div className={styles.nebiusStats}>
        <div className={styles.nebiusStat}>
          <span className={styles.nebiusStatVal} style={{ color: hasSuccess ? '#1D9E75' : '#888780' }}>
            {rl.call_count ?? 0}
          </span>
          <span className={styles.nebiusStatLabel}>calls ok</span>
        </div>
        <div className={styles.nebiusStat}>
          <span className={styles.nebiusStatVal} style={{ color: hasErrors ? '#A32D2D' : '#888780' }}>
            {rl.call_errors ?? 0}
          </span>
          <span className={styles.nebiusStatLabel}>errors</span>
        </div>
        <div className={styles.nebiusStat}>
          <span className={styles.nebiusStatVal} style={{ color: '#534AB7' }}>
            {rl.last_latency_ms ? `${rl.last_latency_ms}ms` : '—'}
          </span>
          <span className={styles.nebiusStatLabel}>latency</span>
        </div>
      </div>

      {rl.last_response && (
        <div className={styles.nebiusLast}>
          last: dx={rl.last_response.dx.toFixed(3)}, dy={rl.last_response.dy.toFixed(3)}
        </div>
      )}

      {!hasKey && (
        <div className={styles.nebiusWarn}>
          Set NEBIUS_API_KEY in backend/.env
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ simState, connected, error }) {
  const logRef        = useRef(null);
  const logEntriesRef = useRef([]);

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
          {error ? `Backend unreachable — ${error}`
            : connected ? 'Connected — waiting for first frame...'
            : 'Connecting to ws://localhost:8008/ws ...'}
        </div>
      </div>
    );
  }

  const { fsm_state, ekf, slam, planning, rl, drone } = simState;
  const s      = FSM_STYLE[fsm_state] || FSM_STYLE.IDLE;
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
        <div className={styles.rlModeBadge} data-mode={rl.mode}>
          {rl.mode === 'nebius' ? 'Nebius LLM' : 'Simulated'}
        </div>
        <MetricRow label="Path nodes"     value={planning.path_nodes || '—'} />
        <MetricRow label="Obs avoided"    value={planning.obs_avoided} color="#854F0B" />
        <MetricRow label="RL reward"      value={rl.reward.toFixed(2)} color="#0F6E56" />
        <MetricRow label="RL corrections" value={rl.corrections} color="#854F0B" />
        <MetricRow label="Q-value"        value={rl.q_value.toFixed(2)} color="#534AB7" />
        <Bar value={rl.q_value} color="#534AB7" max={1} />
      </Section>

      <NebиusPanel rl={rl} />

      <div className={styles.log} ref={logRef} />
    </div>
  );
}
