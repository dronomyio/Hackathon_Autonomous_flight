class World:
    def __init__(self, cols: int, rows: int):
        self.cols = cols
        self.rows = rows
        self.grid = [[0] * cols for _ in range(rows)]
        self.obstacles: set = set()
        self._init_walls()
        self._init_obstacles()

    def _init_walls(self):
        for c in range(self.cols):
            self.grid[0][c] = 1
            self.grid[self.rows - 1][c] = 1
        for r in range(self.rows):
            self.grid[r][0] = 1
            self.grid[r][self.cols - 1] = 1

    def _init_obstacles(self):
        static = [
            (5, 3, 3, 4), (10, 1, 2, 7), (15, 5, 3, 3),
            (3, 10, 6, 2), (12, 10, 2, 5), (18, 3, 3, 6),
            (7, 15, 4, 2), (14, 15, 5, 3), (2, 18, 3, 3),
            (17, 18, 4, 2), (8, 8, 3, 4), (20, 12, 3, 4),
            (5, 20, 5, 2), (22, 7, 2, 5), (16, 22, 3, 3),
        ]
        for (c, r, w, h) in static:
            self.add_obstacle(c, r, w, h)

    def add_obstacle(self, col: int, row: int, w: int, h: int):
        for dc in range(w):
            for dr in range(h):
                cc, rr = col + dc, row + dr
                if 0 <= rr < self.rows and 0 <= cc < self.cols:
                    self.grid[rr][cc] = 1
                    self.obstacles.add(rr * self.cols + cc)
