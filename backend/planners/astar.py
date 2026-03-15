"""
A* Global Planner — with obstacle inflation.
Inflates obstacles by 1 cell radius before planning so the drone body
never clips corners. Falls back to uninflated grid if no path found.
"""

import heapq
import math
from typing import Optional


def _inflate(grid: list, rows: int, cols: int, radius: int = 1) -> list:
    """Return a new grid with obstacles expanded by `radius` cells."""
    inflated = [row[:] for row in grid]
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1:
                for dr in range(-radius, radius + 1):
                    for dc in range(-radius, radius + 1):
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < rows and 0 <= nc < cols:
                            inflated[nr][nc] = 1
    return inflated


def _search(grid: list, rows: int, cols: int,
            sr: int, sc: int, er: int, ec: int) -> Optional[list]:
    def h(r, c):
        return math.hypot(r - er, c - ec)

    open_heap = [(h(sr, sc), 0.0, sr, sc)]
    g_score   = {(sr, sc): 0.0}
    came_from = {}
    visited   = set()
    neighbors = [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]

    while open_heap:
        f, g, r, c = heapq.heappop(open_heap)
        if (r, c) in visited:
            continue
        visited.add((r, c))

        if r == er and c == ec:
            path, cur = [], (r, c)
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


def astar(
    grid: list,
    rows: int,
    cols: int,
    sr: int,
    sc: int,
    er: int,
    ec: int,
    inflate: int = 1,
) -> Optional[list]:
    """
    Plan path from (sr,sc) to (er,ec).
    Tries inflated grid first for clearance; falls back to raw grid.
    """
    inflated = _inflate(grid, rows, cols, radius=inflate)

    # If start or goal got inflated away, use raw grid directly
    if inflated[sr][sc] == 1 or inflated[er][ec] == 1:
        return _search(grid, rows, cols, sr, sc, er, ec)

    path = _search(inflated, rows, cols, sr, sc, er, ec)
    if path is not None:
        return path

    # Fallback: uninflated grid (tight corridors)
    return _search(grid, rows, cols, sr, sc, er, ec)
