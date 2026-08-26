import type { MotionState, ScrollDirection } from "./types";

const MAX_FRAME_DELTA_MS = 100;

export interface ScrollViewport {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface ScrollEngineCallbacks {
  onMotionChange?: (state: MotionState, direction: ScrollDirection) => void;
  onBoundary?: (direction: ScrollDirection) => void;
}

export interface ScrollStep {
  position: number;
  reachedBoundary: boolean;
}

const browserScheduler: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle)
};

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return 36;
  }
  return Math.min(160, Math.max(4, speed));
}

export function calculateScrollStep(
  position: number,
  maximum: number,
  speed: number,
  direction: ScrollDirection,
  elapsedMs: number
): ScrollStep {
  const safeMaximum = Math.max(0, maximum);
  const safePosition = Math.min(safeMaximum, Math.max(0, position));
  const safeElapsed = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, elapsedMs));
  const distance = clampSpeed(speed) * (safeElapsed / 1000) * direction;
  const next = Math.min(safeMaximum, Math.max(0, safePosition + distance));
  const reachedBoundary = direction === 1 ? next >= safeMaximum : next <= 0;

  return { position: next, reachedBoundary };
}

export class ScrollEngine {
  private speed: number;
  private direction: ScrollDirection = 1;
  private running = false;
  private frameHandle: number | null = null;
  private previousTimestamp: number | null = null;
  private destroyed = false;

  constructor(
    private readonly viewport: ScrollViewport,
    speed: number,
    private readonly callbacks: ScrollEngineCallbacks = {},
    private readonly scheduler: FrameScheduler = browserScheduler
  ) {
    this.speed = clampSpeed(speed);
  }

  get motionState(): MotionState {
    if (!this.running) {
      return "paused";
    }
    return this.direction === 1 ? "forward" : "reverse";
  }

  get currentDirection(): ScrollDirection {
    return this.direction;
  }

  get isRunning(): boolean {
    return this.running;
  }

  setSpeed(speed: number): void {
    this.speed = clampSpeed(speed);
  }

  start(direction: ScrollDirection): void {
    if (this.destroyed) {
      return;
    }

    if (this.running && this.direction === direction) {
      return;
    }

    const wasRunning = this.running;
    this.direction = direction;

    if (this.isAtBoundary(direction)) {
      this.running = false;
      this.previousTimestamp = null;
      this.cancelFrame();
      this.emitMotionChange();
      this.callbacks.onBoundary?.(direction);
      return;
    }

    this.running = true;

    if (!wasRunning) {
      this.previousTimestamp = null;
      this.scheduleFrame();
    }

    this.emitMotionChange();
  }

  pause(): void {
    if (this.destroyed || !this.running) {
      return;
    }

    this.running = false;
    this.previousTimestamp = null;
    this.cancelFrame();
    this.emitMotionChange();
  }

  toggle(): void {
    if (this.running) {
      this.pause();
    } else {
      this.start(this.direction);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.running = false;
    this.previousTimestamp = null;
    this.cancelFrame();
  }

  private readonly onFrame: FrameRequestCallback = (timestamp) => {
    this.frameHandle = null;

    if (!this.running || this.destroyed) {
      return;
    }

    if (this.previousTimestamp === null) {
      this.previousTimestamp = timestamp;
      this.scheduleFrame();
      return;
    }

    const maximum = Math.max(0, this.viewport.scrollHeight - this.viewport.clientHeight);
    const step = calculateScrollStep(
      this.viewport.scrollTop,
      maximum,
      this.speed,
      this.direction,
      timestamp - this.previousTimestamp
    );

    this.previousTimestamp = timestamp;
    this.viewport.scrollTop = step.position;

    if (step.reachedBoundary) {
      const boundaryDirection = this.direction;
      this.pause();
      this.callbacks.onBoundary?.(boundaryDirection);
      return;
    }

    this.scheduleFrame();
  };

  private isAtBoundary(direction: ScrollDirection): boolean {
    const maximum = Math.max(0, this.viewport.scrollHeight - this.viewport.clientHeight);
    return direction === 1
      ? this.viewport.scrollTop >= maximum - 0.5
      : this.viewport.scrollTop <= 0.5;
  }

  private scheduleFrame(): void {
    if (this.frameHandle === null && this.running && !this.destroyed) {
      this.frameHandle = this.scheduler.request(this.onFrame);
    }
  }

  private cancelFrame(): void {
    if (this.frameHandle !== null) {
      this.scheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
  }

  private emitMotionChange(): void {
    this.callbacks.onMotionChange?.(this.motionState, this.direction);
  }
}
