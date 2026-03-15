"""
Dynamic Window Approach — Local Planner
Samples velocity space and scores by: goal heading, obstacle clearance, speed.
"""

import math


def dwa_select_velocity(
    drone: dict,
    target: dict,
    obstacles: set,
    cols: int,
    rows: int,
    cell: int,
    speed: float,
) -> tuple:
    """
    Returns (vx, vy) best local velocity toward target avoiding obstacles.
    """
    best_score = -float("inf")
    bvx, bvy = 0.0, 0.0
    max_v = speed * 0.9
    steps = 8

    for i in range(steps + 1):
        for j in range(steps + 1):
            vx = (i / steps) * max_v * 2 - max_v
            vy = (j / steps) * max_v * 2 - max_v
            nx = drone["x"] + vx
            ny = drone["y"] + vy

            # Obstacle clearance
            min_dist = float("inf")
            for k in obstacles:
                rr, cc = k // cols, k % cols
                ox = cc * cell + cell / 2
                oy = rr * cell + cell / 2
                dist = math.hypot(nx - ox, ny - oy)
                if dist < min_dist:
                    min_dist = dist

            if min_dist < cell * 0.65:
                continue

            vel = math.hypot(vx, vy)
            gd = math.hypot(target["x"] - nx, target["y"] - ny)
            heading_score = 0.0
            if vel > 0:
                goal_ang = math.atan2(target["y"] - ny, target["x"] - nx)
                vel_ang = math.atan2(vy, vx)
                heading_score = math.cos(goal_ang - vel_ang)

            score = 3.0 * heading_score + 1.2 * (min_dist / cell) - 0.4 * gd / cell

            if score > best_score:
                best_score = score
                bvx, bvy = vx, vy

    return bvx, bvy
