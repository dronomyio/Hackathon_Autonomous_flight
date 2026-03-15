"""
RL Correction Agent — dual-mode
Uses plain httpx (no openai package) to call Nebius API.
"""

import math
import json
import random
import os
import threading
import time
from collections import deque

RL_MODE             = os.getenv("RL_MODE", "simulated").strip().lower()
NEBIUS_API_KEY      = os.getenv("NEBIUS_API_KEY", "").strip()
NEBIUS_MODEL        = os.getenv("NEBIUS_MODEL", "meta-llama/Meta-Llama-3.1-8B-Instruct").strip()
NEBIUS_CONTEXT_FRAMES = int(os.getenv("NEBIUS_CONTEXT_FRAMES", "3"))

def _make_nebius_client():
    import httpx
    return httpx.Client(
        base_url="https://api.studio.nebius.com",
        headers={
            "Authorization": f"Bearer {NEBIUS_API_KEY}",
            "Content-Type": "application/json",
        },
        timeout=10.0,
    )

_SYSTEM_PROMPT = """\
You are a drone flight-correction policy for a 2D autonomous navigation system.
Output a small corrective thrust vector (dx, dy) to keep the drone on its path.
Rules: dx and dy in [-1.0, 1.0]. Prioritise obstacle clearance over path following.
Respond ONLY with valid JSON: {"dx": <float>, "dy": <float>}
No explanation. No other text."""

def _build_llm_prompt(state_frames):
    lines = []
    for i, f in enumerate(state_frames):
        lines.append(f"--- frame t-{len(state_frames)-1-i} ---")
        lines.append(f"position: ({f['x']:.1f}, {f['y']:.1f})")
        lines.append(f"velocity: ({f['vx']:.2f}, {f['vy']:.2f})")
        lines.append(f"path_deviation: {f['path_dev']:.2f} cells")
        lines.append(f"nearest_obs: {f['nearest_obs']:.2f} cells")
        lines.append(f"ekf_cov_trace: {f['ekf_cov']:.3f}")
        lines.append(f"fsm_state: {f['fsm_state']}")
    lines.append("\nOutput correction thrust JSON:")
    return "\n".join(lines)

class RLAgent:
    def __init__(self):
        self.reward      = 0.0
        self.corrections = 0
        self.q_value     = 0.5
        self.mode = RL_MODE if (RL_MODE == "nebius" and NEBIUS_API_KEY) else "simulated"
        self._client        = None
        self._context       = deque(maxlen=NEBIUS_CONTEXT_FRAMES)
        self._pending_dx    = 0.0
        self._pending_dy    = 0.0
        self._last_call_t   = 0.0
        self._call_interval = 0.15
        self._lock          = threading.Lock()
        self._llm_ready     = True
        self.call_count     = 0
        self.call_errors    = 0
        self.last_response  = None
        self.last_latency_ms = 0
        if self.mode == "nebius":
            print(f"[RLAgent] Mode: NEBIUS ({NEBIUS_MODEL})")
        else:
            print("[RLAgent] Mode: SIMULATED (rule-based)")

    def set_mode(self, mode):
        mode = mode.strip().lower()
        if mode == "nebius":
            if not NEBIUS_API_KEY:
                return {"ok": False, "error": "NEBIUS_API_KEY not set"}
            self.mode = "nebius"
            self._context.clear()
            print("[RLAgent] Switched to NEBIUS mode")
            return {"ok": True, "mode": "nebius", "model": NEBIUS_MODEL}
        else:
            self.mode = "simulated"
            print("[RLAgent] Switched to SIMULATED mode")
            return {"ok": True, "mode": "simulated"}

    def get_status(self):
        return {
            "mode": self.mode,
            "model": NEBIUS_MODEL if self.mode == "nebius" else None,
            "api_key_set": bool(NEBIUS_API_KEY),
            "reward": round(self.reward, 2),
            "corrections": self.corrections,
            "q_value": round(self.q_value, 2),
            "call_count": self.call_count,
            "call_errors": self.call_errors,
            "last_response": self.last_response,
            "last_latency_ms": self.last_latency_ms,
        }

    def correct(self, drone, target, global_path, cell, enabled, speed,
                ekf_cov=2.0, fsm_state="NAVIGATING", obstacles=None, cols=32):
        if not enabled:
            return 0.0, 0.0
        if self.mode == "nebius":
            return self._nebius_correct(drone, target, global_path, cell, speed,
                                        ekf_cov, fsm_state, obstacles or set(), cols)
        return self._simulated_correct(drone, target, global_path, cell, speed)

    def _simulated_correct(self, drone, target, global_path, cell, speed):
        path_dev = 0.0
        if len(global_path) > 1:
            p = global_path[min(2, len(global_path) - 1)]
            path_dev = math.hypot(drone["x"] - p[1]*cell - cell/2,
                                  drone["y"] - p[0]*cell - cell/2) / cell
        r = -path_dev * 0.1 + (0.5 if path_dev < 1.5 else 0.0)
        self.reward  += r * 0.01
        self.q_value  = min(1.0, max(0.0, self.q_value + r*0.02 + (random.random()-0.5)*0.03))
        if path_dev > 1.8 and len(global_path) > 1:
            p   = global_path[min(1, len(global_path) - 1)]
            tx  = p[1]*cell + cell/2
            ty  = p[0]*cell + cell/2
            ang = math.atan2(ty - drone["y"], tx - drone["x"])
            self.corrections += 1
            return math.cos(ang)*speed*0.55, math.sin(ang)*speed*0.55
        return 0.0, 0.0

    def _nebius_correct(self, drone, target, global_path, cell, speed,
                        ekf_cov, fsm_state, obstacles, cols):
        path_dev, heading_err = 0.0, 0.0
        if len(global_path) > 1:
            p = global_path[min(2, len(global_path)-1)]
            tx = p[1]*cell + cell/2
            ty = p[0]*cell + cell/2
            path_dev = math.hypot(drone["x"]-tx, drone["y"]-ty) / cell
        nearest_obs = 99.0
        for k in obstacles:
            rr, cc = k//cols, k%cols
            d = math.hypot(drone["x"]-cc*cell-cell/2, drone["y"]-rr*cell-cell/2) / cell
            if d < nearest_obs:
                nearest_obs = d
        snap = {"x": drone["x"], "y": drone["y"], "vx": drone["vx"], "vy": drone["vy"],
                "path_dev": path_dev, "nearest_obs": nearest_obs,
                "ekf_cov": ekf_cov, "fsm_state": fsm_state, "heading_err": heading_err}
        self._context.append(snap)
        now = time.time()
        if now - self._last_call_t < self._call_interval:
            with self._lock:
                dx, dy = self._pending_dx, self._pending_dy
            return dx*speed*0.55, dy*speed*0.55
        if self._llm_ready:
            self._llm_ready = False
            self._last_call_t = now
            t = threading.Thread(target=self._call_nebius, args=(list(self._context),), daemon=True)
            t.start()
        with self._lock:
            dx, dy = self._pending_dx, self._pending_dy
        r = -path_dev*0.1 + (0.5 if path_dev < 1.5 else 0.0)
        self.reward  += r*0.01
        self.q_value  = min(1.0, max(0.0, self.q_value + r*0.02))
        if abs(dx)+abs(dy) > 0.05:
            self.corrections += 1
        return dx*speed*0.55, dy*speed*0.55

    def _call_nebius(self, frames):
        t0 = time.time()
        try:
            if self._client is None:
                self._client = _make_nebius_client()
            resp = self._client.post("/v1/chat/completions", json={
                "model": NEBIUS_MODEL,
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user",   "content": _build_llm_prompt(frames)},
                ],
                "max_tokens": 32,
                "temperature": 0.2,
            })
            resp.raise_for_status()
            raw  = resp.json()["choices"][0]["message"]["content"].strip()
            data = json.loads(raw)
            dx   = float(max(-1.0, min(1.0, data.get("dx", 0.0))))
            dy   = float(max(-1.0, min(1.0, data.get("dy", 0.0))))
            with self._lock:
                self._pending_dx    = dx
                self._pending_dy    = dy
                self.last_response  = {"dx": round(dx,3), "dy": round(dy,3)}
                self.last_latency_ms = round((time.time()-t0)*1000)
                self.call_count    += 1
            print(f"[RLAgent/Nebius] call #{self.call_count} → dx={dx:.3f} dy={dy:.3f} ({self.last_latency_ms}ms)")
        except Exception as e:
            self.call_errors += 1
            print(f"[RLAgent/Nebius] LLM call failed (error #{self.call_errors}): {e}")
        finally:
            self._llm_ready = True
