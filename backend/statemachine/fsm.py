"""
Flight State Machine
States: IDLE, TAKEOFF, NAVIGATING, AVOIDING, RL_CORRECT, REPLAN, LAND, FAULT
"""

from enum import Enum


class FSMState(str, Enum):
    IDLE       = "IDLE"
    TAKEOFF    = "TAKEOFF"
    NAVIGATING = "NAVIGATING"
    AVOIDING   = "AVOIDING"
    RL_CORRECT = "RL_CORRECT"
    REPLAN     = "REPLAN"
    LAND       = "LAND"
    FAULT      = "FAULT"


# Valid transitions: source → set of allowed targets
TRANSITIONS: dict[FSMState, set] = {
    FSMState.IDLE:       {FSMState.TAKEOFF},
    FSMState.TAKEOFF:    {FSMState.NAVIGATING, FSMState.FAULT},
    FSMState.NAVIGATING: {FSMState.AVOIDING, FSMState.RL_CORRECT, FSMState.REPLAN, FSMState.LAND, FSMState.FAULT},
    FSMState.AVOIDING:   {FSMState.REPLAN, FSMState.FAULT},
    FSMState.RL_CORRECT: {FSMState.NAVIGATING, FSMState.FAULT},
    FSMState.REPLAN:     {FSMState.NAVIGATING, FSMState.FAULT},
    FSMState.LAND:       {FSMState.IDLE},
    FSMState.FAULT:      {FSMState.REPLAN, FSMState.IDLE},
}


class FlightFSM:
    def __init__(self):
        self.state = FSMState.IDLE
        self.timer = 0
        self.history: list[tuple[int, str, str]] = []

    def tick(self):
        self.timer += 1

    def transition(self, target: FSMState) -> bool:
        if target == self.state:
            return False
        allowed = TRANSITIONS.get(self.state, set())
        if target not in allowed:
            return False
        self.history.append((self.timer, self.state.value, target.value))
        if len(self.history) > 50:
            self.history.pop(0)
        self.state = target
        self.timer = 0
        return True
