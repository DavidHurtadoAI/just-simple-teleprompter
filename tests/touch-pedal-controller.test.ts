import { describe, expect, it } from "vitest";
import { TouchPedalController, isPedalEdgePoint } from "../src/touch-pedal-controller";

const point = (clientX: number, clientY = 0) => ({ clientX, clientY });

describe("iOS touch pedal gestures", () => {
  it("maps the right pedal's left swipe to forward", () => {
    const controller = new TouchPedalController();
    expect(controller.begin(point(1), 100)).toBe(true);
    expect(controller.move(point(0.5))).toBe(true);
    expect(controller.end(point(0), 315)).toBe("forward");
  });

  it("maps the left pedal's right swipe to reverse", () => {
    const controller = new TouchPedalController();
    expect(controller.begin(point(0), 100)).toBe(true);
    expect(controller.move(point(0.5))).toBe(true);
    expect(controller.end(point(1), 300)).toBe("reverse");
  });

  it("ignores ordinary screen gestures away from the top-left edge", () => {
    const controller = new TouchPedalController();
    expect(controller.begin(point(40, 80), 100)).toBe(false);
    expect(controller.end(point(10, 80), 300)).toBeNull();
  });

  it("ignores taps and slow edge gestures", () => {
    const tap = new TouchPedalController();
    tap.begin(point(1), 100);
    expect(tap.end(point(1), 200)).toBeNull();

    const slow = new TouchPedalController();
    slow.begin(point(1), 100);
    expect(slow.end(point(0), 1000)).toBeNull();
  });

  it("cancels when a gesture leaves the pedal's two-pixel corner", () => {
    const controller = new TouchPedalController();
    controller.begin(point(1), 100);
    expect(controller.move(point(8))).toBe(false);
    expect(controller.end(point(0), 300)).toBeNull();
  });

  it("recognizes only the two-pixel top-left capture area", () => {
    expect(isPedalEdgePoint(point(0, 0))).toBe(true);
    expect(isPedalEdgePoint(point(2, 2))).toBe(true);
    expect(isPedalEdgePoint(point(2.1, 0))).toBe(false);
    expect(isPedalEdgePoint(point(0, 2.1))).toBe(false);
  });
});
