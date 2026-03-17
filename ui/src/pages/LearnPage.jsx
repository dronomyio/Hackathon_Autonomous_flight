import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket, apiPost } from '../hooks/useWebSocket.js';
import WorldCanvas from '../components/WorldCanvas.jsx';
import LESSONS from '../components/Learn/lessons.js';
import styles from './LearnPage.module.css';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8008';

async function updateCode(filename, code) {
  try {
    const res = await fetch(`${API_BASE}/code/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, code }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function CodeTab({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 10, padding: '3px 10px', borderRadius: '4px 4px 0 0',
        border: '0.5px solid rgba(255,255,255,0.18)',
        borderBottom: active ? 'none' : '0.5px solid rgba(255,255,255,0.18)',
        background: active ? '#1e2538' : '#161b27',
        color: active ? color : 'rgba(255,255,255,0.65)',
        cursor: 'pointer', fontFamily: 'monospace', fontWeight: active ? 700 : 400,
        marginRight: 2,
      }}
    >
      {label}
    </button>
  );
}

function SyntaxCode({ code, lang }) {
  const lines = code.split('\n');
  return (
    <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.75, fontFamily: 'monospace',
                  color: '#e6edf3', overflow: 'auto' }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex' }}>
          <span style={{ minWidth: 28, color: 'rgba(255,255,255,0.35)',
                         userSelect: 'none', textAlign: 'right', paddingRight: 12,
                         fontSize: 10 }}>
            {i + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: highlight(line, lang) }} />
        </div>
      ))}
    </pre>
  );
}

function highlight(line, lang) {
  let s = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if (lang === 'cpp') {
    s = s.replace(/\/\/.*/g, m => `<span style="color:rgba(255,255,255,0.35);font-style:italic">${m}</span>`);
    s = s.replace(/\b(double|int|void|bool|auto|const|for|if|while|return|true|false|class|struct|nullptr)\b/g,
      m => `<span style="color:#7c6af7">${m}</span>`);
    s = s.replace(/\b([A-Z][a-zA-Z]+)\b/g, m => `<span style="color:#d4886a">${m}</span>`);
    s = s.replace(/\b(\d+\.?\d*)\b/g, m => `<span style="color:#e09f3e">${m}</span>`);
  } else {
    s = s.replace(/#.*/g, m => `<span style="color:rgba(255,255,255,0.35);font-style:italic">${m}</span>`);
    s = s.replace(/\b(def|return|for|if|else|elif|import|from|class|True|False|None|in|not|and|or)\b/g,
      m => `<span style="color:#7c6af7">${m}</span>`);
    s = s.replace(/\b(self|range|int|float|str|list|dict|set)\b/g,
      m => `<span style="color:#d4886a">${m}</span>`);
    s = s.replace(/\b(\d+\.?\d*)\b/g, m => `<span style="color:#e09f3e">${m}</span>`);
    s = s.replace(/"([^"]*)"/g, (m,p) => `<span style="color:#3dbb7e">"${p}"</span>`);
  }
  return s;
}

export default function LearnPage() {
  const { simState, connected } = useWebSocket();
  const [lessonIdx, setLessonIdx] = useState(1); // default: DWA
  const [codeTab, setCodeTab] = useState('py');   // 'cpp' or 'py'
  const [editedCode, setEditedCode] = useState('');
  const [runStatus, setRunStatus] = useState(null);
  const [runTime, setRunTime] = useState(null);

  const lesson = LESSONS[lessonIdx];

  useEffect(() => {
    setEditedCode(lesson.py_code);
    setRunStatus(null);
    setCodeTab('py');
  }, [lessonIdx]);

  const handleCanvasClick = useCallback(async (col, row) => {
    await apiPost('/goal', { col, row });
  }, []);

  const isReadOnly = !lesson.py_file;

  async function handleRun() {
    if (isReadOnly) return;
    setRunStatus('running');
    const t0 = Date.now();
    const result = await updateCode(lesson.py_file, editedCode);
    setRunTime(Date.now() - t0);
    setRunStatus(result.ok ? 'ok' : 'error:' + result.error);
  }

  async function handleReset() {
    setEditedCode(lesson.py_code);
    setRunStatus(null);
  }

  const rl = simState?.rl;
  const ekf = simState?.ekf;
  const slam = simState?.slam;
  const planning = simState?.planning;

  function getMetricValue(key) {
    if (!simState) return '—';
    switch (key) {
      case 'mapped_pct':      return slam?.mapped_pct + '%';
      case 'obs_avoided':     return planning?.obs_avoided;
      case 'rl_corrections':  return rl?.corrections;
      case 'ekf_innovation':  return ekf?.innovation?.toFixed(2);
      case 'fsm_state':       return simState?.fsm_state;
      default:                return '—';
    }
  }

  return (
    <div className={styles.shell}>

      {/* ── TOP NAV ── */}
      <div className={styles.topnav}>
        <Link to="/" className={styles.logo}>KR AUTONOMOUS FLIGHT</Link>
        <span className={styles.sep}>/</span>
        <span className={styles.logo} style={{ color: '#70b8ff' }}>LEARN</span>

        <div className={styles.lessonPills}>
          {LESSONS.map((l, i) => (
            <button
              key={l.id}
              className={`${styles.pill} ${i === lessonIdx ? styles.pillActive : ''}`}
              style={i === lessonIdx ? { background: l.color + '33', color: l.textColor,
                borderColor: l.color + '88' } : {}}
              onClick={() => setLessonIdx(i)}
            >
              {l.title.split('—')[0].trim()}
            </button>
          ))}
        </div>

        <div className={styles.progress}>
          <span>{lessonIdx + 1} / {LESSONS.length}</span>
          <div className={styles.progTrack}>
            <div className={styles.progFill}
              style={{ width: `${((lessonIdx + 1) / LESSONS.length) * 100}%` }} />
          </div>
        </div>

        <Link to="/" className={styles.simLink}>← Back to sim</Link>
      </div>

      {/* ── THREE PANELS ── */}
      <div className={styles.body}>

        {/* PANEL 1 — Code editor */}
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Code editor</span>
            <span className={styles.fileBadge}
              style={{ background: lesson.color + '33', color: lesson.textColor,
                       borderColor: lesson.color + '66' }}>
              {lesson.id}.py
            </span>
          </div>

          <div className={styles.tabRow}>
            <CodeTab label="Original (reference)"  active={codeTab==='cpp'}
              onClick={() => setCodeTab('cpp')} color="#854F0B" />
            <CodeTab label="Your Python (editable)" active={codeTab==='py'}
              onClick={() => setCodeTab('py')} color="#185FA5" />
          </div>

          {codeTab === 'cpp' ? (
            <div className={styles.codeDisplay}>
              <div className={styles.origBanner}>
                📂 {lesson.original_label}
              </div>
              <div className={styles.codeScroll}>
                <SyntaxCode code={lesson.original_code} lang="cpp" />
              </div>
            </div>
          ) : (
            <div className={styles.codeDisplay}>
              <div className={styles.pyBanner}>
                {isReadOnly
                  ? `📖 ${lesson.original_label}  ·  read-only — requires container restart`
                  : `✏️  ${lesson.py_file}  ·  edit → click ▶ Run → watch sim respond`}
              </div>
              <textarea
                className={styles.editor}
                value={editedCode}
                onChange={e => setEditedCode(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}

          <div className={styles.runBar}>
            <button className={styles.runBtn} onClick={handleRun}
              disabled={!connected || codeTab === 'cpp' || isReadOnly}>
              ▶ Run
            </button>
            <button className={styles.resetBtn} onClick={handleReset}>
              ↺ Reset
            </button>
            {runStatus === 'running' && (
              <span className={styles.statusRunning}>Running...</span>
            )}
            {runStatus === 'ok' && (
              <span className={styles.statusOk}>✓ Reloaded in {runTime}ms — watch the sim</span>
            )}
            {runStatus?.startsWith('error') && (
              <span className={styles.statusErr}>{runStatus.replace('error:', '')}</span>
            )}
            {isReadOnly && codeTab === 'py' && (
              <span style={{ fontSize: 10, color: '#ffa657', marginLeft: 8 }}>
                ⚠ This file requires a container restart to apply — observe the logic, tune DWA/EKF/A*/RL lessons instead
              </span>
            )}
            {!isReadOnly && codeTab === 'cpp' && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)',
                             marginLeft: 8 }}>
                Switch to Python tab to edit
              </span>
            )}
          </div>
        </div>

        {/* PANEL 2 — Live sim */}
        <div className={styles.panel} style={{ background: '#141c28' }}>
          <div className={styles.panelHead} style={{ background: '#1a2438' }}>
            <span className={styles.panelTitle} style={{ color: 'rgba(255,255,255,0.6)' }}>
              Live sim
            </span>
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4,
                           background: connected ? 'rgba(46,255,160,0.15)' : 'rgba(255,80,80,0.15)',
                           color: connected ? '#2effa0' : '#ff6060',
                           border: `0.5px solid ${connected ? 'rgba(46,255,160,0.4)' : 'rgba(255,80,80,0.4)'}`,
                           fontWeight: 700 }}>
              {connected ? 'LIVE' : 'CONNECTING'}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
              Click canvas to set goal
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex',
                        flexDirection: 'column', minHeight: 0 }}>
            <WorldCanvas simState={simState} onCanvasClick={handleCanvasClick} />
          </div>
          {/* Mini FSM strip */}
          <div style={{ padding: '6px 10px', background: '#1a2438',
                        borderTop: '0.5px solid rgba(255,255,255,0.08)',
                        display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['IDLE','TAKEOFF','NAVIGATING','AVOIDING','RL_CORRECT','REPLAN','LAND','FAULT'].map(s => (
              <span key={s} style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace',
                background: simState?.fsm_state === s ? lesson.color + '33' : 'rgba(255,255,255,0.04)',
                color: simState?.fsm_state === s ? lesson.textColor : 'rgba(255,255,255,0.3)',
                border: `0.5px solid ${simState?.fsm_state === s ? lesson.color + '66' : 'rgba(255,255,255,0.1)'}`,
                fontWeight: simState?.fsm_state === s ? 700 : 400,
              }}>{s}</span>
            ))}
          </div>
        </div>

        {/* PANEL 3 — Lesson guide */}
        <div className={styles.panel}>
          <div className={styles.panelHead}
            style={{ background: lesson.color + '22', borderBottom: `0.5px solid ${lesson.color}44` }}>
            <span className={styles.panelTitle} style={{ color: lesson.textColor }}>
              {lesson.title}
            </span>
          </div>

          <div className={styles.lessonScroll}>

            {/* What it controls */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>What it controls</div>
              <div className={styles.sectionBody}>{lesson.what_it_controls}</div>
            </div>

            {/* Try this */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Try this</div>
              {lesson.try_this.map((t, i) => (
                <div key={i} className={styles.tryRow}>
                  <code className={styles.tryCode}
                    style={{ background: lesson.color + '22', color: lesson.textColor }}>
                    {t.label}
                  </code>
                  <span className={styles.tryEffect}>{t.effect}</span>
                </div>
              ))}
            </div>

            {/* C++ ↔ Python diff */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Original ↔ your edit — same algorithm</div>
              <div className={styles.diffGrid}>
                <div className={styles.diffCol} style={{ background: '#FFF8F0' }}>
                  <div className={styles.diffLabel} style={{ color: '#854F0B' }}>Original · {lesson.original_label}</div>
                  <code style={{ fontSize: 10, color: '#633806', fontFamily: 'monospace', lineHeight: 1.6 }}>
                    {lesson.original_code.split('\n').slice(0, 8).join('\n')}
                  </code>
                </div>
                <div className={styles.diffCol} style={{ background: '#F0F8FF' }}>
                  <div className={styles.diffLabel} style={{ color: '#70b8ff' }}>Python · {lesson.py_file ? lesson.py_file.split('/').pop() : 'observe only'}</div>
                  <code style={{ fontSize: 10, color: '#0C447C', fontFamily: 'monospace', lineHeight: 1.6 }}>
                    {lesson.py_code.split('\n').slice(0, 8).join('\n')}
                  </code>
                </div>
              </div>
            </div>

            {/* Challenge */}
            <div className={styles.section}>
              <div className={styles.challengeBox}
                style={{ borderColor: lesson.color + '88', background: lesson.color + '18' }}>
                <div className={styles.challengeLabel} style={{ color: lesson.textColor }}>
                  CHALLENGE
                </div>
                <div className={styles.challengeText}>{lesson.challenge}</div>
                <div className={styles.challengeMetrics}>
                  <div className={styles.metricItem}>
                    <span className={styles.metricLabel}>Current</span>
                    <span className={styles.metricVal}
                      style={{ color: lesson.textColor }}>
                      {getMetricValue(lesson.challenge_metric)}
                    </span>
                  </div>
                  <div className={styles.metricItem}>
                    <span className={styles.metricLabel}>Target</span>
                    <span className={styles.metricVal}>{lesson.challenge_target}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Prev / Next navigation */}
          <div className={styles.navBar}>
            <button className={styles.navBtn}
              onClick={() => setLessonIdx(i => Math.max(0, i - 1))}
              disabled={lessonIdx === 0}>
              ← Prev
            </button>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>
              {lesson.subtitle}
            </span>
            <button className={styles.navBtn}
              onClick={() => setLessonIdx(i => Math.min(LESSONS.length - 1, i + 1))}
              disabled={lessonIdx === LESSONS.length - 1}>
              Next →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

