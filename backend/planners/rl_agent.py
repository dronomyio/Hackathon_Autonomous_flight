"""
RL Correction Agent
Simulated Q-learning policy that corrects path deviation.
In production this would load a trained network checkpoint.
"""

import math
import random


class RLAgent:
    def __init__(self):
        self.reward = 0.0
        self.corrections = 0
        self.q_value = 0.5

    def correct(
        self,
        drone: dict,
        target: dict,
        global_path: list,
        cell: int,
        enabled: bool,
        speed: float,
    ) -> tuple:
        """
        Returns (dx, dy) corrective thrust.
        Updates internal reward and Q-value estimate.
        """
        if not enabled:
            return 0.0, 0.0

        path_dev = 0.0
        if len(global_path) > 1:
            p = global_path[min(2, len(global_path) - 1)]
            path_dev = math.hypot(
                drone["x"] - p[1] * cell - cell / 2,
                drone["y"] - p[0] * cell - cell / 2,
            ) / cell

        # Simulated Bellman update
        r = -path_dev * 0.1 + (0.5 if path_dev < 1.5 else 0.0)
        self.reward += r * 0.01
        self.q_value = min(1.0, max(0.0, self.q_value + r * 0.02 + (random.random() - 0.5) * 0.03))

        if path_dev > 1.8 and len(global_path) > 1:
            p = global_path[min(1, len(global_path) - 1)]
            tx = p[1] * cell + cell / 2
            ty = p[0] * cell + cell / 2
            ang = math.atan2(ty - drone["y"], tx - drone["x"])
            self.corrections += 1
            return math.cos(ang) * speed * 0.55, math.sin(ang) * speed * 0.55

        return 0.0, 0.0
