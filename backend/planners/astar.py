"""
A* Global Planner
8-connected grid search with diagonal movement.
"""

import heapq
import math
from typing import Optional


def astar(
    grid: list,
    rows: int,
    cols: int,
    sr: int,
    sc: int,
    er: int,
    ec: int,
) -> Optional[list]:
    """
    Returns list of [row, col] waypoints from start to end, or None if no path.
    """
    def h(r, c):
        return math.hypot(r - er, c - ec)

    open_heap = [(h(sr, sc), 0.0, sr, sc)]
    g_score = {(sr, sc): 0.0}
    came_from = {}
    visited = set()

    neighbors = [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]

    while open_heap:
        f, g, r, c = heapq.heappop(open_heap)
        if (r, c) in visited:
            continue
        visited.add((r, c))

        if r == er and c == ec:
            path = []
            cur = (r, c)
            while cur in came_from:
                path.append(list(cur))
                cur = came_from[cur]
            path.reverse()
            path.append([er, ec])
            return path

        for dr, dc in neighbors:
            nr, nc = r + dr, c + dc
            if nr < 0 or nr >= rows or nc < 0 or nc >= cols:
                continue
            if grid[nr][nc] == 1:
                continue
            ng = g + math.hypot(dr, dc)
            if ng < g_score.get((nr, nc), float("inf")):
                g_score[(nr, nc)] = ng
                came_from[(nr, nc)] = (r, c)
                heapq.heappush(open_heap, (ng + h(nr, nc), ng, nr, nc))

    return None
