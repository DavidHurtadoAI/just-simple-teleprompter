import type { TeleprompterAction } from "./types";

const EDGE_LIMIT_PX = 2;
const MAX_GESTURE_DURATION_MS = 800;
const MIN_HORIZONTAL_MOVEMENT_PX = 0.001;

export interface TouchPoint {
  clientX: number;
  clientY: number;
}

interface GestureStart {
  x: number;
  at: number;
}

export class TouchPedalController {
  private start: GestureStart | null = null;

  begin(point: TouchPoint, at: number): boolean {
    if (!isPedalEdgePoint(point)) {
      this.start = null;
      return false;
    }
    this.start = { x: point.clientX, at };
    return true;
  }

  move(point: TouchPoint): boolean {
    if (this.start === null) {
      return false;
    }
    if (!isPedalEdgePoint(point)) {
      this.start = null;
      return false;
    }
    return true;
  }

  end(point: TouchPoint, at: number): TeleprompterAction | null {
    const start = this.start;
    this.start = null;
    if (
      start === null ||
      !isPedalEdgePoint(point) ||
      at - start.at > MAX_GESTURE_DURATION_MS
    ) {
      return null;
    }

    const horizontalMovement = point.clientX - start.x;
    if (Math.abs(horizontalMovement) < MIN_HORIZONTAL_MOVEMENT_PX) {
      return null;
    }
    return horizontalMovement < 0 ? "forward" : "reverse";
  }

  cancel(): void {
    this.start = null;
  }

  get isTracking(): boolean {
    return this.start !== null;
  }
}

export function isPedalEdgePoint(point: TouchPoint): boolean {
  return (
    point.clientX >= 0 &&
    point.clientX <= EDGE_LIMIT_PX &&
    point.clientY >= 0 &&
    point.clientY <= EDGE_LIMIT_PX
  );
}
