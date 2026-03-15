"""
Dynamic Window Approach — Local Planner
Samples velocity space, scores by heading + clearance + goal distance.
Uses a repulsion vector when completely boxed in.
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
    best_score      = -float("inf")
    bvx, bvy        = 0.0, 0.0
    best_clearance  = -float("inf")
    cvx, cvy        = 0.0, 0.0   # best clearance fallback

    max_v         = speed * 0.9
    steps         = 12            # finer grid
    min_clearance = cell * 0.5    # half-cell minimum

    # Pre-compute nearest obstacle direction for repulsion fallback
    rep_x, rep_y, min_global = 0.0, 0.0, float("inf")
    for k in obstacles:
        rr, cc = k // cols, k % cols
        ox = cc * cell + cell / 2
        oy = rr * cell + cell / 2
        d  = math.hypot(drone["x"] - ox, drone["y"] - oy)
        if d < min_global:
            min_global = d
            rep_x = drone["x"] - ox
            rep_y = drone["y"] - oy

    for i in range(steps + 1):
        for j in range(steps + 1):
            vx = (i / steps) * max_v * 2 - max_v
            vy = (j / steps) * max_v * 2 - max_v

            nx = drone["x"] + vx
            ny = drone["y"] + vy

            min_dist = float("inf")
            for k in obstacles:
                rr, cc = k // cols, k % cols
                ox = cc * cell + cell / 2
                oy = rr * cell + cell / 2
                d  = math.hypot(nx - ox, ny - oy)
                if d < min_dist:
                    min_dist = d

            vel = math.hypot(vx, vy)
            gd  = math.hypot(target["x"] - nx, target["y"] - ny)

            heading_score = 0.0
            if vel > 0:
                goal_ang = math.atan2(target["y"] - ny, target["x"] - nx)
                vel_ang  = math.atan2(vy, vx)
                heading_score = math.cos(goal_ang - vel_ang)

            clearance_score = min_dist / cell
            score = 3.0 * heading_score + 2.0 * clearance_score - 0.3 * gd / cell

            # Track best-clearance candidate for fallback
            if clearance_score > best_clearance:
                best_clearance = clearance_score
                cvx, cvy = vx, vy

            if min_dist >= min_clearance and score > best_score:
                best_score = score
                bvx, bvy   = vx, vy

    # No safe candidate → use repulsion vector away from nearest obstacle
    if best_score == -float("inf"):
        mag = math.hypot(rep_x, rep_y)
        if mag > 0:
            return (rep_x / mag) * speed * 0.6, (rep_y / mag) * speed * 0.6
        return cvx * 0.4, cvy * 0.4

    return bvx, bvy
