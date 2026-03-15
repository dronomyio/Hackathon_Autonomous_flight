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
        # Sparser layout — wider corridors so DWA always has a navigable path
        static = [
            (6,  3,  2, 3),
            (11, 2,  2, 5),
            (16, 4,  2, 3),
            (4,  11, 4, 2),
            (13, 10, 2, 4),
            (19, 4,  2, 5),
            (8,  16, 3, 2),
            (15, 16, 3, 2),
            (3,  19, 2, 3),
            (18, 19, 3, 2),
            (9,  9,  2, 3),
            (21, 13, 2, 3),
            (6,  21, 3, 2),
            (23, 8,  2, 4),
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
