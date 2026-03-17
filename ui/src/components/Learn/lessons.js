// lessons.js — all code shown here is the REAL source from this project.
// "Original" tab = working default. "Your edit" tab = what the student changes.
// No fabricated C++ — we show exactly what the sim actually runs.

const LESSONS = [
  {
    id: "slam",
    title: "SLAM — LiDAR mapping",
    subtitle: "How 24 rays build the occupancy grid",
    color: "#F4C0D1",
    textColor: "#72243E",
    original_label: "SimEngine._update_slam()  ·  src/main.py",
    original_code: `def _update_slam(self):
    dr = int(self.drone["y"] / CELL)
    dc = int(self.drone["x"] / CELL)
    self.lidar_rays = []
    n_rays    = 24     # ← try changing to 8 or 48
    ray_range = 7      # ← try changing to 3 or 14

    for i in range(n_rays):
        ang = (i / n_rays) * math.pi * 2
        for d in range(1, ray_range + 1):
            rr = round(dr + math.sin(ang) * d)
            rc = round(dc + math.cos(ang) * d)
            if rr < 0 or rr >= ROWS or rc < 0 or rc >= COLS:
                break
            if not self.explored[rr][rc]:
                self.explored[rr][rc] = True
                self.explored_count += 1
            if self.world.grid[rr][rc] == 1:
                self.slam_map[rr][rc] = 1   # obstacle
                self.lidar_rays.append({
                    "x": self.drone["x"] + math.cos(ang)*d*CELL,
                    "y": self.drone["y"] + math.sin(ang)*d*CELL,
                    "hit": True
                })
                break
            else:
                self.slam_map[rr][rc] = 0   # free
    if self.sim_time % 280 == 0 and self.sim_time > 0:
        self.loop_closures += 1`,
    py_file: null, // main.py not hot-reloadable — read-only lesson
    py_code: `def _update_slam(self):
    dr = int(self.drone["y"] / CELL)
    dc = int(self.drone["x"] / CELL)
    self.lidar_rays = []
    n_rays    = 24     # ← try changing to 8 or 48
    ray_range = 7      # ← try changing to 3 or 14

    for i in range(n_rays):
        ang = (i / n_rays) * math.pi * 2
        for d in range(1, ray_range + 1):
            rr = round(dr + math.sin(ang) * d)
            rc = round(dc + math.cos(ang) * d)
            if rr < 0 or rr >= ROWS or rc < 0 or rc >= COLS:
                break
            if not self.explored[rr][rc]:
                self.explored[rr][rc] = True
                self.explored_count += 1
            if self.world.grid[rr][rc] == 1:
                self.slam_map[rr][rc] = 1   # obstacle
                self.lidar_rays.append({
                    "x": self.drone["x"] + math.cos(ang)*d*CELL,
                    "y": self.drone["y"] + math.sin(ang)*d*CELL,
                    "hit": True
                })
                break
            else:
                self.slam_map[rr][rc] = 0   # free
    if self.sim_time % 280 == 0 and self.sim_time > 0:
        self.loop_closures += 1`,
    what_it_controls: `This is the real SLAM loop running in your sim right now — SimEngine._update_slam() in src/main.py.

Every tick it fires n_rays laser beams outward from the drone. Each ray travels cell by cell until it hits an obstacle (slam_map = 1, red) or reaches ray_range (slam_map = 0, blue).

n_rays = 24 means 360° / 24 = one ray every 15 degrees.
ray_range = 7 means each ray sees 7 cells = 140px ahead.

These are the actual lines the running container executes. Edit them, click Run, and watch the ray pattern on the canvas change immediately.`,
    try_this: [
      { label: "n_rays = 24  →  n_rays = 6", effect: "Map builds with huge blind spots — drone gets surprised by obstacles it walked past without seeing" },
      { label: "ray_range = 7  →  ray_range = 3", effect: "Short-sighted drone — A* plans into dark unknown space and replans constantly" },
      { label: "ray_range = 7  →  ray_range = 14", effect: "Long-range vision — map fills fast, watch explored_count jump in the SLAM panel" },
    ],
    challenge: "Tune n_rays and ray_range so SLAM maps 80% of the grid in under 400 ticks.",
    challenge_metric: "mapped_pct",
    challenge_target: 80,
  },

  {
    id: "dwa",
    title: "DWA — Local planner",
    subtitle: "144 velocity candidates scored every frame",
    color: "#FAC775",
    textColor: "#633806",
    original_label: "dwa_select_velocity()  ·  planners/dwa.py",
    original_code: `def dwa_select_velocity(drone, target, obstacles,
                        cols, rows, cell, speed):
    best_score    = -float("inf")
    bvx, bvy      = 0.0, 0.0
    max_v         = speed * 0.9
    steps         = 12           # 12x12 = 144 candidates
    min_clearance = cell * 0.5   # ← half-cell safety margin

    for i in range(steps + 1):
        for j in range(steps + 1):
            vx = (i / steps) * max_v * 2 - max_v
            vy = (j / steps) * max_v * 2 - max_v
            nx = drone["x"] + vx
            ny = drone["y"] + vy

            min_dist = float("inf")
            for k in obstacles:
                rr, cc = k // cols, k % cols
                d = math.hypot(nx - cc*cell - cell/2,
                               ny - rr*cell - cell/2)
                if d < min_dist:
                    min_dist = d

            vel = math.hypot(vx, vy)
            gd  = math.hypot(target["x"]-nx, target["y"]-ny)
            heading_score = 0.0
            if vel > 0:
                goal_ang = math.atan2(target["y"]-ny, target["x"]-nx)
                vel_ang  = math.atan2(vy, vx)
                heading_score = math.cos(goal_ang - vel_ang)

            # ↓↓ SCORING FUNCTION — tune these three weights ↓↓
            score = (3.0 * heading_score
                   + 2.0 * min_dist / cell
                   - 0.3 * gd / cell)

            if min_dist >= min_clearance and score > best_score:
                best_score = score
                bvx, bvy   = vx, vy

    return bvx, bvy`,
    py_file: "planners/dwa.py",
    py_code: `def dwa_select_velocity(drone, target, obstacles,
                        cols, rows, cell, speed):
    best_score    = -float("inf")
    bvx, bvy      = 0.0, 0.0
    max_v         = speed * 0.9
    steps         = 12           # 12x12 = 144 candidates
    min_clearance = cell * 0.5   # ← half-cell safety margin

    for i in range(steps + 1):
        for j in range(steps + 1):
            vx = (i / steps) * max_v * 2 - max_v
            vy = (j / steps) * max_v * 2 - max_v
            nx = drone["x"] + vx
            ny = drone["y"] + vy

            min_dist = float("inf")
            for k in obstacles:
                rr, cc = k // cols, k % cols
                d = math.hypot(nx - cc*cell - cell/2,
                               ny - rr*cell - cell/2)
                if d < min_dist:
                    min_dist = d

            vel = math.hypot(vx, vy)
            gd  = math.hypot(target["x"]-nx, target["y"]-ny)
            heading_score = 0.0
            if vel > 0:
                goal_ang = math.atan2(target["y"]-ny, target["x"]-nx)
                vel_ang  = math.atan2(vy, vx)
                heading_score = math.cos(goal_ang - vel_ang)

            # ↓↓ SCORING FUNCTION — tune these three weights ↓↓
            score = (3.0 * heading_score
                   + 2.0 * min_dist / cell
                   - 0.3 * gd / cell)

            if min_dist >= min_clearance and score > best_score:
                best_score = score
                bvx, bvy   = vx, vy

    return bvx, bvy`,
    what_it_controls: `This is the complete DWA velocity selector — the real planners/dwa.py your sim runs.

It evaluates 144 (vx, vy) candidates every frame on a 12x12 grid. For each it simulates one step forward (nx, ny) and scores on three objectives:

  3.0 x heading_score   — how well velocity points toward goal
  2.0 x min_dist/cell   — how far from nearest obstacle  
  0.3 x gd/cell         — penalty for distance to goal

Any candidate closer than min_clearance (0.5 cells) to an obstacle is rejected. The highest scoring safe candidate becomes the drone velocity that frame.`,
    try_this: [
      { label: "3.0 * heading_score  →  0.5 * heading_score", effect: "Drone stops caring about goal direction — wanders while maintaining clearance. Watch it orbit obstacles" },
      { label: "2.0 * min_dist/cell  →  0.1 * min_dist/cell", effect: "Drone ignores obstacle distance — clips walls. Collision counter spikes" },
      { label: "min_clearance = cell * 0.5  →  cell * 1.5", effect: "Drone demands 1.5-cell bubble — rejects candidates near walls, takes very wide arcs" },
    ],
    challenge: "Tune the three weights so the drone reaches any goal in under 600 ticks with zero collisions.",
    challenge_metric: "obs_avoided",
    challenge_target: 0,
  },

  {
    id: "ekf",
    title: "EKF — State estimator",
    subtitle: "Fuse IMU + SLAM into a clean pose estimate",
    color: "#B5D4F4",
    textColor: "#0C447C",
    original_label: "class EKF  ·  estimator/ekf.py",
    original_code: `class EKF:
    def __init__(self, x=0.0, y=0.0):
        self.state_x = x
        self.state_y = y
        self.vx, self.vy = 0.0, 0.0
        self.P = [          # 4x4 covariance matrix
            [1.0, 0, 0, 0],
            [0, 1.0, 0, 0],
            [0, 0, 0.5, 0],
            [0, 0, 0, 0.5],
        ]
        self.Q = 0.02   # ← process noise — tune this
        self.R = 0.15   # ← measurement noise — tune this

    def predict(self, dt, ax, ay):
        # Propagate state with IMU acceleration
        self.state_x += self.vx*dt + 0.5*ax*dt*dt
        self.state_y += self.vy*dt + 0.5*ay*dt*dt
        self.vx += ax * dt
        self.vy += ay * dt
        # Inflate covariance by process noise
        for i in range(4):
            self.P[i][i] += self.Q  # ← watch Cov trace P in sidebar

    def update(self, meas_x, meas_y):
        # Fuse SLAM position measurement (Kalman gain)
        inn_x = meas_x - self.state_x
        inn_y = meas_y - self.state_y
        Kx = self.P[0][0] / (self.P[0][0] + self.R)
        Ky = self.P[1][1] / (self.P[1][1] + self.R)
        self.state_x += Kx * inn_x
        self.state_y += Ky * inn_y
        self.P[0][0] = max(0.001, self.P[0][0] * (1 - Kx))
        self.P[1][1] = max(0.001, self.P[1][1] * (1 - Ky))
        return math.hypot(inn_x, inn_y)  # innovation`,
    py_file: "estimator/ekf.py",
    py_code: `class EKF:
    def __init__(self, x=0.0, y=0.0):
        self.state_x = x
        self.state_y = y
        self.vx, self.vy = 0.0, 0.0
        self.P = [          # 4x4 covariance matrix
            [1.0, 0, 0, 0],
            [0, 1.0, 0, 0],
            [0, 0, 0.5, 0],
            [0, 0, 0, 0.5],
        ]
        self.Q = 0.02   # ← process noise — tune this
        self.R = 0.15   # ← measurement noise — tune this

    def predict(self, dt, ax, ay):
        # Propagate state with IMU acceleration
        self.state_x += self.vx*dt + 0.5*ax*dt*dt
        self.state_y += self.vy*dt + 0.5*ay*dt*dt
        self.vx += ax * dt
        self.vy += ay * dt
        # Inflate covariance by process noise
        for i in range(4):
            self.P[i][i] += self.Q  # ← watch Cov trace P in sidebar

    def update(self, meas_x, meas_y):
        # Fuse SLAM position measurement (Kalman gain)
        inn_x = meas_x - self.state_x
        inn_y = meas_y - self.state_y
        Kx = self.P[0][0] / (self.P[0][0] + self.R)
        Ky = self.P[1][1] / (self.P[1][1] + self.R)
        self.state_x += Kx * inn_x
        self.state_y += Ky * inn_y
        self.P[0][0] = max(0.001, self.P[0][0] * (1 - Kx))
        self.P[1][1] = max(0.001, self.P[1][1] * (1 - Ky))
        return math.hypot(inn_x, inn_y)  # innovation`,
    what_it_controls: `This is the real EKF — estimator/ekf.py.

predict() uses drone velocity + acceleration to project where the drone should be now. update() fuses that prediction with a noisy SLAM position measurement using Bayes rule (Kalman gain).

Q = process noise: how fast uncertainty grows between measurements.
R = measurement noise: how much to trust SLAM positions.

The purple dot on the canvas is (state_x, state_y). The Cov trace P bar in the sidebar is sum of P diagonal — total uncertainty. Click Inject Fault and watch it flood.`,
    try_this: [
      { label: "self.Q = 0.02  →  self.Q = 1.0", effect: "Covariance inflates fast — purple dot wanders far from drone. Filter stops trusting its own prediction" },
      { label: "self.R = 0.15  →  self.R = 10.0", effect: "Filter ignores SLAM measurements — relies on IMU prediction only. Position error accumulates" },
      { label: "self.R = 0.15  →  self.R = 0.001", effect: "Filter trusts SLAM completely — near-zero error but very sensitive to SLAM noise spikes" },
    ],
    challenge: "Tune Q and R so Innovation stays below 1.5 even after clicking Inject Fault.",
    challenge_metric: "ekf_innovation",
    challenge_target: 1.5,
  },

  {
    id: "astar",
    title: "A* — Global planner",
    subtitle: "Shortest path on the inflated occupancy grid",
    color: "#9FE1CB",
    textColor: "#085041",
    original_label: "astar() + _inflate()  ·  planners/astar.py",
    original_code: `def _inflate(grid, rows, cols, radius=1):
    """Expand every obstacle by radius cells."""
    inflated = [row[:] for row in grid]
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1:
                for dr in range(-radius, radius+1):
                    for dc in range(-radius, radius+1):
                        nr, nc = r+dr, c+dc
                        if 0<=nr<rows and 0<=nc<cols:
                            inflated[nr][nc] = 1
    return inflated

def astar(grid, rows, cols, sr, sc, er, ec, inflate=1):
    inflated = _inflate(grid, rows, cols, radius=inflate)
    if inflated[sr][sc]==1 or inflated[er][ec]==1:
        return _search(grid, rows, cols, sr, sc, er, ec)
    path = _search(inflated, rows, cols, sr, sc, er, ec)
    if path is not None:
        return path
    return _search(grid, rows, cols, sr, sc, er, ec)

def _search(grid, rows, cols, sr, sc, er, ec):
    def h(r, c): return math.hypot(r-er, c-ec)
    open_heap = [(h(sr,sc), 0.0, sr, sc)]
    g_score, came_from = {(sr,sc): 0.0}, {}
    neighbors = [(-1,0),(1,0),(0,-1),(0,1),
                 (-1,-1),(-1,1),(1,-1),(1,1)]
    while open_heap:
        f, g, r, c = heapq.heappop(open_heap)
        if r==er and c==ec:
            path, cur = [], (r, c)
            while cur in came_from:
                path.append(list(cur))
                cur = came_from[cur]
            path.reverse()
            return path
        for dr, dc in neighbors:
            nr, nc = r+dr, c+dc
            if grid[nr][nc]==1: continue
            ng = g + math.hypot(dr, dc)
            if ng < g_score.get((nr,nc), float("inf")):
                g_score[(nr,nc)] = ng
                came_from[(nr,nc)] = (r, c)
                heapq.heappush(open_heap,
                    (ng+h(nr,nc), ng, nr, nc))`,
    py_file: "planners/astar.py",
    py_code: `def _inflate(grid, rows, cols, radius=1):
    """Expand every obstacle by radius cells."""
    inflated = [row[:] for row in grid]
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1:
                for dr in range(-radius, radius+1):
                    for dc in range(-radius, radius+1):
                        nr, nc = r+dr, c+dc
                        if 0<=nr<rows and 0<=nc<cols:
                            inflated[nr][nc] = 1
    return inflated

def astar(grid, rows, cols, sr, sc, er, ec, inflate=1):
    inflated = _inflate(grid, rows, cols, radius=inflate)
    if inflated[sr][sc]==1 or inflated[er][ec]==1:
        return _search(grid, rows, cols, sr, sc, er, ec)
    path = _search(inflated, rows, cols, sr, sc, er, ec)
    if path is not None:
        return path
    return _search(grid, rows, cols, sr, sc, er, ec)

def _search(grid, rows, cols, sr, sc, er, ec):
    def h(r, c): return math.hypot(r-er, c-ec)
    open_heap = [(h(sr,sc), 0.0, sr, sc)]
    g_score, came_from = {(sr,sc): 0.0}, {}
    neighbors = [(-1,0),(1,0),(0,-1),(0,1),
                 (-1,-1),(-1,1),(1,-1),(1,1)]
    while open_heap:
        f, g, r, c = heapq.heappop(open_heap)
        if r==er and c==ec:
            path, cur = [], (r, c)
            while cur in came_from:
                path.append(list(cur))
                cur = came_from[cur]
            path.reverse()
            return path
        for dr, dc in neighbors:
            nr, nc = r+dr, c+dc
            if grid[nr][nc]==1: continue
            ng = g + math.hypot(dr, dc)
            if ng < g_score.get((nr,nc), float("inf")):
                g_score[(nr,nc)] = ng
                came_from[(nr,nc)] = (r, c)
                heapq.heappush(open_heap,
                    (ng+h(nr,nc), ng, nr, nc))`,
    what_it_controls: `This is the complete A* planner — planners/astar.py.

When you click a goal, astar() runs _inflate() to expand every obstacle outward by inflate cells (default 1), then searches the inflated grid with a min-heap. The blue dashed line is the returned path.

inflate=1 means the drone never routes within 1 cell of a wall. If inflation makes start or goal unreachable, it automatically falls back to the raw grid.

h(r,c) = euclidean distance to goal — admissible heuristic, guarantees optimal path.`,
    try_this: [
      { label: "inflate=1  →  inflate=0", effect: "Path routes through 1-cell gaps — drone clips wall corners. Watch collision counter" },
      { label: "inflate=1  →  inflate=2", effect: "Wider safety margin — tight corridors become impassable, A* routes the long way around" },
      { label: "hypot(r-er, c-ec)  →  abs(r-er)+abs(c-ec)", effect: "Manhattan heuristic — prefers axis-aligned moves, slightly different path shapes" },
    ],
    challenge: "Set inflate so the drone never collides but still navigates the tightest corridor in the map.",
    challenge_metric: "obs_avoided",
    challenge_target: 0,
  },

  {
    id: "fsm",
    title: "FSM — Flight state machine",
    subtitle: "8 states, guarded transitions",
    color: "#CECBF6",
    textColor: "#3C3489",
    original_label: "SimEngine._fsm_tick()  ·  src/main.py",
    original_code: `def _fsm_tick(self):
    near_obs = any(
        math.hypot(
            d["x"] - (k%COLS)*CELL - CELL/2,
            d["y"] - (k//COLS)*CELL - CELL/2
        ) < CELL * 0.9    # ← tune: near_obs threshold
        for k in self.world.obstacles
    )
    path_dev = 0.0
    if len(self.global_path) > 1:
        p = self.global_path[min(2, len(self.global_path)-1)]
        path_dev = math.hypot(
            d["x"] - p[1]*CELL - CELL/2,
            d["y"] - p[0]*CELL - CELL/2
        ) / CELL

    if st == FSMState.NAVIGATING:
        if self.fault_active:
            self.fsm.transition(FSMState.FAULT)
        elif near_obs:
            self.fsm.transition(FSMState.AVOIDING)
        elif path_dev > 1.8 and self.rl_enabled:  # ← tune
            self.fsm.transition(FSMState.RL_CORRECT)
        elif dist_to_goal < CELL * 0.9:
            self.fsm.transition(FSMState.LAND)

    elif st == FSMState.AVOIDING:
        if not near_obs:
            self.fsm.transition(FSMState.REPLAN)
        elif self.fsm.timer > 45:    # ← tune: timeout ticks
            self._log("fsm", "AVOIDING timeout — REPLAN")
            self.fsm.transition(FSMState.REPLAN)

    elif st == FSMState.RL_CORRECT:
        if path_dev < 1.0 or self.fsm.timer > 60:
            self.fsm.transition(FSMState.NAVIGATING)`,
    py_file: null, // main.py not hot-reloadable — read-only lesson
    py_code: `def _fsm_tick(self):
    near_obs = any(
        math.hypot(
            d["x"] - (k%COLS)*CELL - CELL/2,
            d["y"] - (k//COLS)*CELL - CELL/2
        ) < CELL * 0.9    # ← tune: near_obs threshold
        for k in self.world.obstacles
    )
    path_dev = 0.0
    if len(self.global_path) > 1:
        p = self.global_path[min(2, len(self.global_path)-1)]
        path_dev = math.hypot(
            d["x"] - p[1]*CELL - CELL/2,
            d["y"] - p[0]*CELL - CELL/2
        ) / CELL

    if st == FSMState.NAVIGATING:
        if self.fault_active:
            self.fsm.transition(FSMState.FAULT)
        elif near_obs:
            self.fsm.transition(FSMState.AVOIDING)
        elif path_dev > 1.8 and self.rl_enabled:  # ← tune
            self.fsm.transition(FSMState.RL_CORRECT)
        elif dist_to_goal < CELL * 0.9:
            self.fsm.transition(FSMState.LAND)

    elif st == FSMState.AVOIDING:
        if not near_obs:
            self.fsm.transition(FSMState.REPLAN)
        elif self.fsm.timer > 45:    # ← tune: timeout ticks
            self._log("fsm", "AVOIDING timeout — REPLAN")
            self.fsm.transition(FSMState.REPLAN)

    elif st == FSMState.RL_CORRECT:
        if path_dev < 1.0 or self.fsm.timer > 60:
            self.fsm.transition(FSMState.NAVIGATING)`,
    what_it_controls: `This is the real FSM tick — extracted from SimEngine._fsm_tick() in src/main.py.

Three thresholds drive most of the interesting behavior:
  CELL * 0.9   — how close before AVOIDING triggers
  path_dev > 1.8  — how far off-path before RL fires
  fsm.timer > 45  — ticks stuck before forced REPLAN

Watch the FSM state pills at the bottom of the sim panel light up as transitions fire. Every transition is logged in the sidebar with a tick timestamp.`,
    try_this: [
      { label: "CELL * 0.9  →  CELL * 2.0", effect: "AVOIDING triggers 2 cells out — drone starts dodging in open space, erratic in corridors" },
      { label: "path_dev > 1.8  →  path_dev > 0.3", effect: "RL_CORRECT fires constantly — corrections counter spikes, drone oscillates" },
      { label: "fsm.timer > 45  →  fsm.timer > 5", effect: "Aggressive escape — replans very quickly when stuck. More CPU, smoother recovery" },
    ],
    challenge: "Tune all three thresholds so the drone never spends more than 20 ticks in AVOIDING state.",
    challenge_metric: "fsm_state",
    challenge_target: "NAVIGATING",
  },

  {
    id: "rl",
    title: "RL agent — Correction policy",
    subtitle: "Simulated rule-based vs Nebius LLM",
    color: "#F0997B",
    textColor: "#712B13",
    original_label: "RLAgent._simulated_correct()  ·  planners/rl_agent.py",
    original_code: `def _simulated_correct(self, drone, target,
                         global_path, cell, speed):
    """Rule-based — no LLM, always works."""
    path_dev = 0.0
    if len(global_path) > 1:
        p = global_path[min(2, len(global_path)-1)]
        path_dev = math.hypot(
            drone["x"] - p[1]*cell - cell/2,
            drone["y"] - p[0]*cell - cell/2
        ) / cell

    # Simulated reward bookkeeping
    r = -path_dev*0.1 + (0.5 if path_dev < 1.5 else 0.0)
    self.reward  += r * 0.01
    self.q_value  = min(1.0, max(0.0,
        self.q_value + r*0.02 + (random.random()-0.5)*0.03
    ))

    # Fire correction when deviation exceeds threshold
    if path_dev > 1.8 and len(global_path) > 1: # ← tune
        p   = global_path[min(1, len(global_path)-1)]
        tx  = p[1]*cell + cell/2
        ty  = p[0]*cell + cell/2
        ang = math.atan2(ty - drone["y"], tx - drone["x"])
        self.corrections += 1
        return (math.cos(ang)*speed*0.55,   # ← tune gain
                math.sin(ang)*speed*0.55)

    return 0.0, 0.0`,
    py_file: "planners/rl_agent.py",
    py_code: `def _simulated_correct(self, drone, target,
                         global_path, cell, speed):
    """Rule-based — no LLM, always works."""
    path_dev = 0.0
    if len(global_path) > 1:
        p = global_path[min(2, len(global_path)-1)]
        path_dev = math.hypot(
            drone["x"] - p[1]*cell - cell/2,
            drone["y"] - p[0]*cell - cell/2
        ) / cell

    # Simulated reward bookkeeping
    r = -path_dev*0.1 + (0.5 if path_dev < 1.5 else 0.0)
    self.reward  += r * 0.01
    self.q_value  = min(1.0, max(0.0,
        self.q_value + r*0.02 + (random.random()-0.5)*0.03
    ))

    # Fire correction when deviation exceeds threshold
    if path_dev > 1.8 and len(global_path) > 1: # ← tune
        p   = global_path[min(1, len(global_path)-1)]
        tx  = p[1]*cell + cell/2
        ty  = p[0]*cell + cell/2
        ang = math.atan2(ty - drone["y"], tx - drone["x"])
        self.corrections += 1
        return (math.cos(ang)*speed*0.55,   # ← tune gain
                math.sin(ang)*speed*0.55)

    return 0.0, 0.0`,
    what_it_controls: `This is the real simulated RL agent — planners/rl_agent.py.

In simulated mode: when path_dev exceeds 1.8 cells it fires a correction thrust (dx, dy) pointing back toward the nearest waypoint at gain 0.55. The q_value in the sidebar is noisy by design — this agent does not actually learn.

Toggle Nebius LLM in the control bar to replace this with a live Llama 3.1 8B inference call. Same (dx, dy) interface — same function signature, different brain. Watch the Nebius panel show real call latency and the exact JSON the model returned.`,
    try_this: [
      { label: "path_dev > 1.8  →  path_dev > 0.3", effect: "Corrections fire constantly — corrections counter spikes, drone oscillates around path" },
      { label: "speed * 0.55  →  speed * 0.1", effect: "Weak corrections — drone barely responds to deviation, wanders without snapping back" },
      { label: "speed * 0.55  →  speed * 2.0", effect: "Overcorrection — drone overshoots path and oscillates. Classic control instability" },
    ],
    challenge: "Tune threshold and gain so RL corrections stays below 30 for a full cross-map trip.",
    challenge_metric: "rl_corrections",
    challenge_target: 30,
  },
];

export default LESSONS;
