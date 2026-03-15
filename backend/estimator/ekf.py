"""
Extended Kalman Filter — State Estimator
State: [x, y, vx, vy]
Predict: constant-velocity + IMU acceleration input
Update: SLAM position measurement
"""

import math


class EKF:
    def __init__(self, x: float = 0.0, y: float = 0.0):
        self.state_x = x
        self.state_y = y
        self.vx = 0.0
        self.vy = 0.0

        # 4x4 covariance (stored as flat list of rows)
        self.P = [
            [1.0, 0.0, 0.0, 0.0],
            [0.0, 1.0, 0.0, 0.0],
            [0.0, 0.0, 0.5, 0.0],
            [0.0, 0.0, 0.0, 0.5],
        ]

        self.Q = 0.02   # process noise scalar
        self.R = 0.15   # measurement noise scalar

        self.bias = 0.0
        self.bias_drift = 0.0
        self.last_innovation = 0.0

    def predict(self, dt: float, ax: float, ay: float):
        """Propagate state forward with IMU-style acceleration."""
        self.state_x += self.vx * dt + 0.5 * ax * dt * dt
        self.state_y += self.vy * dt + 0.5 * ay * dt * dt
        self.vx += ax * dt
        self.vy += ay * dt
        self.bias += self.bias_drift * dt
        self.bias_drift += (0.001 * (0.5 - 0.5))  # zero-mean random walk placeholder

        # Inflate covariance diagonals with process noise
        for i in range(4):
            self.P[i][i] += self.Q

    def update(self, meas_x: float, meas_y: float) -> float:
        """
        Fuse SLAM position measurement.
        Returns scalar innovation magnitude.
        """
        inn_x = meas_x - self.state_x
        inn_y = meas_y - self.state_y
        self.last_innovation = math.hypot(inn_x, inn_y)

        # Kalman gain K = P H^T (H P H^T + R)^-1
        # H = I for direct position observation
        Sx = self.P[0][0] + self.R
        Sy = self.P[1][1] + self.R
        Kx = self.P[0][0] / Sx
        Ky = self.P[1][1] / Sy

        self.state_x += Kx * inn_x
        self.state_y += Ky * inn_y
        self.vx += 0.3 * Kx * inn_x
        self.vy += 0.3 * Ky * inn_y

        # Joseph-form covariance update (simplified scalar)
        self.P[0][0] = max(0.001, self.P[0][0] * (1 - Kx))
        self.P[1][1] = max(0.001, self.P[1][1] * (1 - Ky))
        self.P[2][2] = max(0.005, self.P[2][2] * 0.98)
        self.P[3][3] = max(0.005, self.P[3][3] * 0.98)

        return self.last_innovation

    def trace(self) -> float:
        return sum(self.P[i][i] for i in range(4))
