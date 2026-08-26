import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "../src/types";

describe("mergeSettings", () => {
  it("uses defaults when there is no saved data", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps numeric settings and rejects malformed values", () => {
    const unsafe = {
      speed: 999,
      fontSize: Number.NaN,
      lineHeight: -4,
      mirrorHorizontally: "yes",
      mirrorVertically: "yes",
      keepAwake: false,
      leftPedalBinding: "not-a-binding",
      rightPedalBinding: "code:PageDown"
    } as unknown as Parameters<typeof mergeSettings>[0];

    expect(mergeSettings(unsafe)).toMatchObject({
      speed: 160,
      fontSize: DEFAULT_SETTINGS.fontSize,
      lineHeight: 1,
      mirrorHorizontally: false,
      mirrorVertically: false,
      keepAwake: false,
      leftPedalBinding: null,
      rightPedalBinding: "code:PageDown"
    });
  });

  it("keeps horizontal and vertical mirroring independent", () => {
    expect(
      mergeSettings({
        mirrorHorizontally: true,
        mirrorVertically: true
      })
    ).toMatchObject({
      mirrorHorizontally: true,
      mirrorVertically: true
    });
  });

  it("clamps text size changes made from the main controls", () => {
    expect(mergeSettings({ fontSize: 22 }).fontSize).toBe(24);
    expect(mergeSettings({ fontSize: 98 }).fontSize).toBe(96);
  });
});
