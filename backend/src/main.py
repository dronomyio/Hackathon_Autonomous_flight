"""
KR Autonomous Flight — Backend
FastAPI + WebSocket simulation server.
Runs SLAM, EKF, A*, DWA, RL, FSM each tick and broadcasts state.
"""

import asyncio
import json
import math
import random
import time
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from planners.astar import astar
from planners.dwa import dwa_select_velocity
from planners.rl_agent import RLAgent
from estimator.ekf import EKF
from statemachine.fsm import FlightFSM, FSMState
from src.world import World

app = FastAPI(title="KR Autonomous Flight API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class GoalRequest(BaseModel):
    col: int
    row: int


class ObstacleRequest(BaseModel):
    col: int
    row: int
    width: int = 3
    height: int = 3


class RLModeRequest(BaseModel):
    mode: str  # "simulated" or "nebius"


# ---------------------------------------------------------------------------
# Simulation state (one global instance for simplicity)
# ---------------------------------------------------------------------------

COLS, ROWS, CELL = 32, 26, 20


class SimEngine:
    def __init__(self):
        self.world = World(COLS, ROWS)
        self.drone = {"x": 2.5 * CELL, "y": 2.5 * CELL, "vx": 0.0, "vy": 0.0, "heading": 0.0}
        # Ensure start position is in a free cell
        sr, sc = int(2.5), int(2.5)
        if self.world.grid[sr][sc] == 1:
            for r in range(1, ROWS - 1):
                for c in range(1, COLS - 1):
                    if self.world.grid[r][c] == 0:
                        self.drone["x"] = c * CELL + CELL / 2
                        self.drone["y"] = r * CELL + CELL / 2
                        break
        self.goal: Optional[dict] = None
        self.global_path: list = []
        self.local_target: Optional[dict] = None
        self.ekf = EKF(x=2.5 * CELL, y=2.5 * CELL)
        self.fsm = FlightFSM()
        self.rl = RLAgent()
        self.running = True
        self.rl_enabled = True
        self.fault_active = False
        self.speed = 1.5
        self.sim_time = 0
        self.explored_count = 0
        self.loop_closures = 0
        self.obs_avoided = 0
        self.slam_noise = 0.0
        self.lidar_rays: list = []
        self.slam_map: list = [[-1] * COLS for _ in range(ROWS)]
        self.explored: list = [[False] * COLS for _ in range(ROWS)]
        self.events: list = []

    def reset(self):
        self.__init__()

    def set_goal(self, col: int, row: int):
        if self.world.grid[row][col] == 1:
            return False
        self.goal = {"x": col * CELL + CELL / 2, "y": row * CELL + CELL / 2}
        self._replan()
        if self.fsm.state in (FSMState.IDLE, FSMState.LAND):
            self.fsm.transition(FSMState.TAKEOFF)
        return True

    def add_obstacle(self, col: int, row: int, w: int = 3, h: int = 3):
        self.world.add_obstacle(col, row, w, h)
        if self.goal:
            self._replan()

    def _replan(self):
        if not self.goal:
            return
        sr = int(self.drone["y"] / CELL)
        sc = int(self.drone["x"] / CELL)
        er = int(self.goal["y"] / CELL)
        ec = int(self.goal["x"] / CELL)
        path = astar(self.world.grid, ROWS, COLS, sr, sc, er, ec)
        if path:
            self.global_path = path
            self._log("nav", f"A* replanned → {len(path)} nodes")
        else:
            self.global_path = []
            self._log("nav", "No path found")

    def _log(self, kind: str, msg: str):
        self.events.append({"t": self.sim_time, "kind": kind, "msg": msg})
        if len(self.events) > 120:
            self.events.pop(0)

    def _update_slam(self):
        dr = int(self.drone["y"] / CELL)
        dc = int(self.drone["x"] / CELL)
        self.lidar_rays = []
        n_rays = 24
        ray_range = 7
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
                    self.slam_map[rr][rc] = 1
                    self.lidar_rays.append({
                        "x": self.drone["x"] + math.cos(ang) * d * CELL,
                        "y": self.drone["y"] + math.sin(ang) * d * CELL,
                        "hit": True
                    })
                    break
                else:
                    self.slam_map[rr][rc] = 0
                    if d == ray_range:
                        self.lidar_rays.append({
                            "x": self.drone["x"] + math.cos(ang) * d * CELL,
                            "y": self.drone["y"] + math.sin(ang) * d * CELL,
                            "hit": False
                        })
        if self.sim_time > 0 and self.sim_time % 280 == 0:
            self.loop_closures += 1
        self.slam_noise = min(40.0, self.slam_noise + 0.04)

    def _fsm_tick(self):
        d = self.drone
        dist_to_goal = (
            math.hypot(d["x"] - self.goal["x"], d["y"] - self.goal["y"])
            if self.goal else float("inf")
        )
        # Tighter threshold (0.9 cell) — 1.5 was trapping drone in dense maps
        near_obs = any(
            math.hypot(d["x"] - (k % COLS) * CELL - CELL / 2,
                       d["y"] - (k // COLS) * CELL - CELL / 2) < CELL * 0.9
            for k in self.world.obstacles
        )
        path_dev = 0.0
        if len(self.global_path) > 1:
            p = self.global_path[min(2, len(self.global_path) - 1)]
            path_dev = math.hypot(d["x"] - p[1] * CELL - CELL / 2,
                                  d["y"] - p[0] * CELL - CELL / 2) / CELL

        st = self.fsm.state
        prev = st

        if st == FSMState.IDLE:
            if self.goal and not self.fault_active:
                self.fsm.transition(FSMState.TAKEOFF)
        elif st == FSMState.TAKEOFF:
            if self.fsm.timer > 30:
                self.fsm.transition(FSMState.NAVIGATING)
        elif st == FSMState.NAVIGATING:
            if self.fault_active:
                self.fsm.transition(FSMState.FAULT)
            elif near_obs:
                self.fsm.transition(FSMState.AVOIDING)
            elif path_dev > 1.8 and self.rl_enabled:
                self.fsm.transition(FSMState.RL_CORRECT)
            elif not self.goal or not self.global_path:
                self.fsm.transition(FSMState.LAND)
            elif dist_to_goal < CELL * 0.9:
                self.fsm.transition(FSMState.LAND)
        elif st == FSMState.AVOIDING:
            if self.fault_active:
                self.fsm.transition(FSMState.FAULT)
            elif not near_obs:
                self.fsm.transition(FSMState.REPLAN)
            elif self.fsm.timer > 45:
                # Timeout escape: stuck in AVOIDING > 1.5s → force replan
                self._log("fsm", "AVOIDING timeout — forcing REPLAN")
                self.fsm.transition(FSMState.REPLAN)
        elif st == FSMState.RL_CORRECT:
            if self.fault_active:
                self.fsm.transition(FSMState.FAULT)
            elif path_dev < 1.0 or self.fsm.timer > 60:
                self.fsm.transition(FSMState.NAVIGATING)
        elif st == FSMState.REPLAN:
            self._replan()
            self.fsm.transition(FSMState.NAVIGATING)
        elif st == FSMState.LAND:
            if self.goal:
                self.fsm.transition(FSMState.IDLE)
            if self.fsm.timer > 60:
                self.goal = None
                self.fsm.transition(FSMState.IDLE)
        elif st == FSMState.FAULT:
            if not self.fault_active and self.fsm.timer > 80:
                self.fsm.transition(FSMState.REPLAN)

        if self.fsm.state != prev:
            self._log("fsm", f"FSM: {prev.value} → {self.fsm.state.value}")

    def tick(self):
        if not self.running:
            return
        self.sim_time += 1
        self.fsm.tick()

        # EKF predict
        ax = self.drone["vx"] + self.slam_noise * (random.random() - 0.5) * 0.1 + self.ekf.bias
        ay = self.drone["vy"] + self.slam_noise * (random.random() - 0.5) * 0.1 + self.ekf.bias
        self.ekf.predict(dt=1 / 30, ax=ax, ay=ay)

        # SLAM
        if self.sim_time % 3 == 0:
            self._update_slam()

        # Fault auto-clear
        if self.fault_active and random.random() < 0.005:
            self.fault_active = False
            self._log("fsm", "Fault cleared — resuming")

        self._fsm_tick()

        active = self.fsm.state in (
            FSMState.NAVIGATING, FSMState.AVOIDING,
            FSMState.RL_CORRECT, FSMState.REPLAN
        )

        if active and self.goal:
            # Local target from global path
            if self.global_path:
                nxt = self.global_path[0]
                self.local_target = {"x": nxt[1] * CELL + CELL / 2, "y": nxt[0] * CELL + CELL / 2}
                lt = self.local_target
                if math.hypot(self.drone["x"] - lt["x"], self.drone["y"] - lt["y"]) < CELL * 0.75:
                    self.global_path.pop(0)
            else:
                self.local_target = self.goal

            target = self.local_target or self.goal
            vx, vy = dwa_select_velocity(self.drone, target, self.world.obstacles, COLS, ROWS, CELL, self.speed)
            dx, dy = self.rl.correct(
                self.drone, target, self.global_path, CELL, self.rl_enabled, self.speed,
                ekf_cov=self.ekf.trace(),
                fsm_state=self.fsm.state.value,
                obstacles=self.world.obstacles,
                cols=COLS,
            )

            self.drone["vx"] = vx + dx * 0.35
            self.drone["vy"] = vy + dy * 0.35

            nx = self.drone["x"] + self.drone["vx"] * self.speed
            ny = self.drone["y"] + self.drone["vy"] * self.speed
            nr, nc = int(ny / CELL), int(nx / CELL)

            if 0 <= nr < ROWS and 0 <= nc < COLS and self.world.grid[nr][nc] == 1:
                self.obs_avoided += 1
                if self.rl_enabled:
                    self.rl.reward -= 1
                self._log("nav", "Collision — obstacle avoided")
                # Push drone to centre of current free cell instead of bouncing in place
                cr = int(self.drone["y"] / CELL)
                cc2 = int(self.drone["x"] / CELL)
                # Walk outward to find nearest free cell
                pushed = False
                for dist in range(1, 4):
                    for dr2, dc2 in [(0,-dist),(0,dist),(-dist,0),(dist,0),
                                     (-dist,-dist),(-dist,dist),(dist,-dist),(dist,dist)]:
                        tr, tc = cr + dr2, cc2 + dc2
                        if 0 <= tr < ROWS and 0 <= tc < COLS and self.world.grid[tr][tc] == 0:
                            self.drone["x"] = tc * CELL + CELL / 2
                            self.drone["y"] = tr * CELL + CELL / 2
                            pushed = True
                            break
                    if pushed:
                        break
                self.drone["vx"] = 0.0
                self.drone["vy"] = 0.0
                self._replan()
            else:
                self.drone["x"] = nx
                self.drone["y"] = ny
                spd = math.hypot(self.drone["vx"], self.drone["vy"])
                if spd > 0.05:
                    self.drone["heading"] = math.atan2(self.drone["vy"], self.drone["vx"])
        else:
            self.drone["vx"] *= 0.8
            self.drone["vy"] *= 0.8

        # EKF measurement update
        m_noise = 5.0 if self.fault_active else 0.5
        inn = self.ekf.update(
            self.drone["x"] + (random.random() - 0.5) * m_noise,
            self.drone["y"] + (random.random() - 0.5) * m_noise,
        )
        self.ekf.state_x = self.ekf.state_x * 0.85 + self.drone["x"] * 0.15
        self.ekf.state_y = self.ekf.state_y * 0.85 + self.drone["y"] * 0.15
        self.ekf.vx = self.drone["vx"]
        self.ekf.vy = self.drone["vy"]

        # Goal reached
        if self.goal and math.hypot(self.drone["x"] - self.goal["x"],
                                    self.drone["y"] - self.goal["y"]) < CELL * 0.85:
            self.rl.reward += 10
            self.goal = None
            self.global_path = []
            self.local_target = None
            self._log("ok", "GOAL REACHED — RL +10, landing")
            self.fsm.transition(FSMState.LAND)

    def get_state(self) -> dict:
        conf = max(55.0, 100.0 - self.slam_noise + self.loop_closures * 6)
        pct = min(100, round(self.explored_count / (COLS * ROWS) * 100))
        new_events = list(self.events)
        self.events = []
        return {
            "sim_time": self.sim_time,
            "drone": self.drone,
            "goal": self.goal,
            "global_path": self.global_path,
            "local_target": self.local_target,
            "lidar_rays": self.lidar_rays,
            "slam_map": self.slam_map,
            "grid": self.world.grid,
            "fsm_state": self.fsm.state.value,
            "ekf": {
                "x": self.ekf.state_x,
                "y": self.ekf.state_y,
                "vx": self.ekf.vx,
                "vy": self.ekf.vy,
                "P_trace": self.ekf.trace(),
                "bias": self.ekf.bias,
                "innovation": self.ekf.last_innovation,
            },
            "slam": {
                "mapped_pct": pct,
                "confidence": round(conf),
                "loop_closures": self.loop_closures,
            },
            "planning": {
                "path_nodes": len(self.global_path),
                "obs_avoided": self.obs_avoided,
            },
            "rl": {
                "reward": round(self.rl.reward, 2),
                "corrections": self.rl.corrections,
                "q_value": round(self.rl.q_value, 2),
                "enabled": self.rl_enabled,
                "mode": self.rl.mode,
                "api_key_set": bool(self.rl.get_status()["api_key_set"]),
            },
            "fault_active": self.fault_active,
            "events": new_events,
        }


sim = SimEngine()


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "sim_time": sim.sim_time}


@app.post("/goal")
def set_goal(req: GoalRequest):
    ok = sim.set_goal(req.col, req.row)
    return {"ok": ok}


@app.post("/obstacle")
def add_obstacle(req: ObstacleRequest):
    sim.add_obstacle(req.col, req.row, req.width, req.height)
    return {"ok": True}


@app.post("/reset")
def reset():
    sim.reset()
    return {"ok": True}


@app.post("/pause")
def pause():
    sim.running = not sim.running
    return {"running": sim.running}


@app.post("/rl/toggle")
def toggle_rl():
    sim.rl_enabled = not sim.rl_enabled
    return {"rl_enabled": sim.rl_enabled}


@app.post("/fault")
def inject_fault():
    sim.fault_active = True
    sim.ekf.P[0][0] += 5
    sim.ekf.P[1][1] += 5
    sim.ekf.bias += 0.5
    sim.fsm.transition(FSMState.FAULT)
    sim._log("fsm", "FAULT injected — EKF covariance spike")
    return {"ok": True}


@app.post("/speed/{value}")
def set_speed(value: float):
    sim.speed = max(0.5, min(4.0, value))
    return {"speed": sim.speed}


# ---------------------------------------------------------------------------
# RL mode endpoints
# ---------------------------------------------------------------------------

@app.get("/rl/status")
def rl_status():
    return sim.rl.get_status()


@app.post("/rl/mode")
def set_rl_mode(req: RLModeRequest):
    result = sim.rl.set_mode(req.mode)
    return result


# ---------------------------------------------------------------------------
# WebSocket — streams simulation state at ~30 fps
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            sim.tick()
            state = sim.get_state()
            await websocket.send_text(json.dumps(state))
            await asyncio.sleep(1 / 30)
    except WebSocketDisconnect:
        pass
