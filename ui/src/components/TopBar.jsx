import styles from './TopBar.module.css';

const BADGES = [
  { label: 'SLAM',        cls: 'pink'   },
  { label: 'A* GLOBAL',  cls: 'blue'   },
  { label: 'DWA LOCAL',  cls: 'teal'   },
  { label: 'RL AGENT',   cls: 'amber'  },
  { label: 'EKF ESTIMATOR', cls: 'purple' },
  { label: 'STATE MACHINE', cls: 'red'  },
];

export default function TopBar({ connected }) {
  return (
    <div className={styles.bar}>
      <span className={styles.title}>KR AUTONOMOUS FLIGHT</span>
      {BADGES.map(b => (
        <span key={b.label} className={`${styles.badge} ${styles[b.cls]}`}>{b.label}</span>
      ))}
      <span className={styles.connLabel} data-connected={connected}>
        {connected ? 'LIVE' : 'CONNECTING...'}
      </span>
    </div>
  );
}
