import { useEffect, useRef } from 'react';

const CELL = 20;

const FSM_COLORS = {
  IDLE:       '#5F5E5A',
  TAKEOFF:    '#185FA5',
  NAVIGATING: '#0F6E56',
  AVOIDING:   '#854F0B',
  RL_CORRECT: '#534AB7',
  REPLAN:     '#993556',
  LAND:       '#3B6D11',
  FAULT:      '#A32D2D',
};

export default function WorldCanvas({ simState, onCanvasClick }) {
  const canvasRef = useRef(null);
  const trailsRef = useRef([]);
  const frameRef = useRef(null);
  const stateRef = useRef(null);

  // Keep latest state accessible inside rAF without re-registering
  useEffect(() => {
    stateRef.current = simState;
    if (simState) {
      const d = simState.drone;
      if (Math.hypot(d.vx, d.vy) > 0.05) {
        trailsRef.current.push({ x: d.x, y: d.y, a: 0.45 });
        if (trailsRef.current.length > 300) trailsRef.current.shift();
      }
    }
  }, [simState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    function draw() {
      frameRef.current = requestAnimationFrame(draw);
      const s = stateRef.current;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#1a2333';
      ctx.fillRect(0, 0, W, H);
      if (!s) return;

      const { grid, slam_map, lidar_rays, global_path, local_target,
              goal, drone, ekf, fsm_state, sim_time, fault_active } = s;

      const ROWS = grid.length, COLS = grid[0].length;

      // SLAM map + obstacles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * CELL, y = r * CELL;
          const sm = slam_map[r][c];
          if (sm === 1) { ctx.fillStyle = 'rgba(160,70,70,0.5)'; ctx.fillRect(x, y, CELL, CELL); }
          else if (sm === 0) { ctx.fillStyle = 'rgba(50,80,130,0.14)'; ctx.fillRect(x, y, CELL, CELL); }
          if (grid[r][c] === 1) {
            ctx.fillStyle = 'rgba(120,50,50,0.85)'; ctx.fillRect(x, y, CELL, CELL);
            ctx.strokeStyle = 'rgba(200,80,80,0.25)'; ctx.lineWidth = 0.5; ctx.strokeRect(x, y, CELL, CELL);
          }
        }
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(100,140,200,0.12)'; ctx.lineWidth = 0.5;
      for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c*CELL,0); ctx.lineTo(c*CELL,H); ctx.stroke(); }
      for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*CELL); ctx.lineTo(W,r*CELL); ctx.stroke(); }

      // LiDAR rays
      lidar_rays.forEach(ray => {
        ctx.beginPath(); ctx.moveTo(drone.x, drone.y); ctx.lineTo(ray.x, ray.y);
        ctx.strokeStyle = ray.hit ? 'rgba(220,100,80,0.3)' : 'rgba(70,190,150,0.1)';
        ctx.lineWidth = 0.6; ctx.stroke();
      });

      // Global path
      if (global_path.length > 1) {
        ctx.beginPath();
        global_path.forEach(([r, c], i) => {
          const px = c * CELL + CELL / 2, py = r * CELL + CELL / 2;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.strokeStyle = 'rgba(55,138,221,0.45)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
        global_path.forEach(([r, c]) => {
          ctx.beginPath(); ctx.arc(c*CELL+CELL/2, r*CELL+CELL/2, 2, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(55,138,221,0.5)'; ctx.fill();
        });
      }

      // EKF estimated position
      const ekfX = ekf.x, ekfY = ekf.y;
      ctx.beginPath(); ctx.arc(ekfX, ekfY, 4, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(160,120,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(drone.x, drone.y); ctx.lineTo(ekfX, ekfY);
      ctx.strokeStyle = 'rgba(160,120,255,0.3)'; ctx.lineWidth = 0.5;
      ctx.setLineDash([2,2]); ctx.stroke(); ctx.setLineDash([]);

      // Trails
      trailsRef.current.forEach(t => {
        ctx.beginPath(); ctx.arc(t.x, t.y, 1.5, 0, Math.PI*2);
        ctx.fillStyle = `rgba(55,180,140,${t.a})`; ctx.fill();
        t.a -= 0.006;
      });
      trailsRef.current = trailsRef.current.filter(t => t.a > 0);

      // Local target
      if (local_target) {
        ctx.beginPath(); ctx.arc(local_target.x, local_target.y, 5, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(0,230,150,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      }

      // Goal
      if (goal) {
        const pulse = 10 + Math.sin(Date.now() * 0.003) * 2;
        ctx.beginPath(); ctx.arc(goal.x, goal.y, pulse, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(255,200,60,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(goal.x, goal.y, 4, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,200,60,0.95)'; ctx.fill();
        ctx.fillStyle = 'rgba(255,200,60,0.7)'; ctx.font = '10px monospace';
        ctx.fillText('GOAL', goal.x + 13, goal.y + 4);
      }

      // Drone
      ctx.save(); ctx.translate(drone.x, drone.y); ctx.rotate(drone.heading);
      const droneColor = fault_active ? 'rgba(255,80,80,0.9)' : 'rgba(80,160,255,0.9)';
      [[10,10],[10,-10],[-10,10],[-10,-10]].forEach(([rx,ry]) => {
        ctx.beginPath(); ctx.arc(rx, ry, 3.5, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(100,200,255,0.1)'; ctx.fill();
        ctx.beginPath(); ctx.arc(rx, ry, 2, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(150,220,255,0.6)'; ctx.fill();
      });
      ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(-6,6); ctx.lineTo(-4,0); ctx.lineTo(-6,-6); ctx.closePath();
      ctx.fillStyle = droneColor; ctx.fill();
      ctx.strokeStyle = 'rgba(180,220,255,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
      [[10,10],[10,-10],[-10,10],[-10,-10]].forEach(([rx,ry]) => {
        ctx.strokeStyle = 'rgba(120,190,255,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(rx,ry); ctx.stroke();
      });
      ctx.restore();

      // FSM label above drone
      ctx.font = '9px monospace';
      ctx.fillStyle = FSM_COLORS[fsm_state] || '#888';
      ctx.textAlign = 'center';
      ctx.fillText(fsm_state, drone.x, drone.y - 18);
      ctx.textAlign = 'left';

      // START label
      ctx.fillStyle = 'rgba(80,230,170,0.9)'; ctx.font = '10px monospace';
      ctx.fillText('START', 14, 13);

      // HUD strip
      ctx.fillStyle = 'rgba(20,28,45,0.75)'; ctx.fillRect(3, 3, 210, 17);
      ctx.fillStyle = 'rgba(80,230,170,1.0)'; ctx.font = '10px monospace';
      ctx.fillText(`EKF (${Math.round(ekf.x)},${Math.round(ekf.y)})  t:${sim_time}`, 7, 14);
    }

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  function handleClick(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);
    onCanvasClick(Math.floor(x / CELL), Math.floor(y / CELL));
  }

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={520}
      onClick={handleClick}
      style={{ display: 'block', cursor: 'crosshair', background: '#1a2333',
               width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}

