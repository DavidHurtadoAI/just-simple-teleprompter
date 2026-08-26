import { describe, expect, it, vi } from "vitest";
import {
  ScrollEngine,
  calculateScrollStep,
  clampSpeed
} from "../src/scroll-engine";
import type { FrameScheduler, ScrollViewport } from "../src/scroll-engine";

class FakeScheduler implements FrameScheduler {
  callbacks = new Map<number, FrameRequestCallback>();
  nextHandle = 1;

  request(callback: FrameRequestCallback): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  runNext(timestamp: number): void {
    const entry = this.callbacks.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined;
    if (!entry) {
      throw new Error("No animation frame is pending.");
    }
    this.callbacks.delete(entry[0]);
    entry[1](timestamp);
  }
}

function viewport(position = 0, height = 1000, clientHeight = 200): ScrollViewport {
  return { scrollTop: position, scrollHeight: height, clientHeight };
}

describe("calculateScrollStep", () => {
  it("moves in both directions", () => {
    expect(calculateScrollStep(100, 800, 40, 1, 100).position).toBe(104);
    expect(calculateScrollStep(100, 800, 40, -1, 100).position).toBe(96);
  });

  it("clamps long frames and both boundaries", () => {
    expect(calculateScrollStep(798, 800, 40, 1, 1000)).toEqual({
      position: 800,
      reachedBoundary: true
    });
    expect(calculateScrollStep(2, 800, 40, -1, 1000)).toEqual({
      position: 0,
      reachedBoundary: true
    });
  });

  it("keeps speed inside the supported range", () => {
    expect(clampSpeed(-10)).toBe(4);
    expect(clampSpeed(999)).toBe(160);
    expect(clampSpeed(Number.NaN)).toBe(36);
  });
});

describe("ScrollEngine", () => {
  it("starts forward and advances on animation frames", () => {
    const target = viewport(100);
    const scheduler = new FakeScheduler();
    const engine = new ScrollEngine(target, 40, {}, scheduler);

    engine.start(1);
    expect(engine.motionState).toBe("forward");
    scheduler.runNext(0);
    scheduler.runNext(100);
    expect(target.scrollTop).toBe(104);
  });

  it.each([
    [1, "forward"],
    [-1, "reverse"]
  ] as const)("starts direction %s when its pedal is pressed while paused", (direction, state) => {
    const target = viewport(100);
    const scheduler = new FakeScheduler();
    const engine = new ScrollEngine(target, 40, {}, scheduler);

    engine.press(direction);

    expect(engine.motionState).toBe(state);
    expect(scheduler.callbacks.size).toBe(1);
  });

  it.each([
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ] as const)("pauses when pedal %s is pressed while moving in direction %s", (pedal, movement) => {
    const target = viewport(100);
    const scheduler = new FakeScheduler();
    const engine = new ScrollEngine(target, 40, {}, scheduler);

    engine.press(movement);
    engine.press(pedal);

    expect(engine.motionState).toBe("paused");
    expect(engine.currentDirection).toBe(movement);
    expect(scheduler.callbacks.size).toBe(0);
  });

  it("uses the newly selected direction on the next press after stopping", () => {
    const target = viewport(100);
    const scheduler = new FakeScheduler();
    const engine = new ScrollEngine(target, 40, {}, scheduler);

    engine.press(1);
    engine.press(-1);
    engine.press(-1);

    expect(engine.motionState).toBe("reverse");
    expect(engine.currentDirection).toBe(-1);
    expect(scheduler.callbacks.size).toBe(1);
  });

  it("pauses at a boundary and reports which boundary was reached", () => {
    const target = viewport(799);
    const scheduler = new FakeScheduler();
    const onBoundary = vi.fn();
    const engine = new ScrollEngine(target, 40, { onBoundary }, scheduler);

    engine.start(1);
    scheduler.runNext(0);
    scheduler.runNext(100);

    expect(target.scrollTop).toBe(800);
    expect(engine.motionState).toBe("paused");
    expect(onBoundary).toHaveBeenCalledWith(1);
    expect(scheduler.callbacks.size).toBe(0);
  });

  it("remembers the last direction across pause and resume", () => {
    const target = viewport(100);
    const scheduler = new FakeScheduler();
    const engine = new ScrollEngine(target, 40, {}, scheduler);

    engine.start(-1);
    engine.pause();
    engine.toggle();

    expect(engine.motionState).toBe("reverse");
  });

  it("does not start beyond the requested boundary", () => {
    const target = viewport(0);
    const scheduler = new FakeScheduler();
    const onBoundary = vi.fn();
    const engine = new ScrollEngine(target, 40, { onBoundary }, scheduler);

    engine.start(-1);

    expect(engine.motionState).toBe("paused");
    expect(onBoundary).toHaveBeenCalledWith(-1);
    expect(scheduler.callbacks.size).toBe(0);
  });
});
