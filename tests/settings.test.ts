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
      keepAwake: false,
      leftPedalBinding: "not-a-binding",
      rightPedalBinding: "code:PageDown"
    } as unknown as Parameters<typeof mergeSettings>[0];

    expect(mergeSettings(unsafe)).toMatchObject({
      speed: 160,
      fontSize: DEFAULT_SETTINGS.fontSize,
      lineHeight: 1,
      mirrorHorizontally: false,
      keepAwake: false,
      leftPedalBinding: null,
      rightPedalBinding: "code:PageDown"
    });
  });
});
