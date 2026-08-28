import { describe, expect, it } from "vitest";
import {
  bindingFromKeyboardInput,
  describeBinding,
  describeKeyboardInput,
  matchesBinding,
  resolveTeleprompterAction
} from "../src/input-controller";

const automatic = {
  leftPedalBinding: null,
  rightPedalBinding: null
};

function input(key: string, code = key, repeat = false): KeyboardEventLike {
  return { key, code, repeat };
}

type KeyboardEventLike = {
  key: string;
  code: string;
  repeat: boolean;
};

describe("automatic pedal mapping", () => {
  it.each(["ArrowRight", "ArrowDown", "PageDown"])("maps %s forward", (key) => {
    expect(resolveTeleprompterAction(input(key), automatic)).toBe("forward");
  });

  it.each(["ArrowLeft", "ArrowUp", "PageUp"])("maps %s in reverse", (key) => {
    expect(resolveTeleprompterAction(input(key), automatic)).toBe("reverse");
  });

  it("maps Space to toggle and Escape to pause", () => {
    expect(resolveTeleprompterAction(input(" ", "Space"), automatic)).toBe("toggle");
    expect(resolveTeleprompterAction(input("Escape"), automatic)).toBe("pause");
  });

  it("ignores keyboard auto-repeat", () => {
    expect(resolveTeleprompterAction(input("ArrowDown", "ArrowDown", true), automatic)).toBeNull();
  });

  it("accepts legacy iOS arrow key names", () => {
    expect(resolveTeleprompterAction(input("UIKeyInputRightArrow", "Unidentified"), automatic)).toBe(
      "forward"
    );
    expect(resolveTeleprompterAction(input("UIKeyInputLeftArrow", "Unidentified"), automatic)).toBe(
      "reverse"
    );
  });

  it("falls back to a usable code when iOS reports an unidentified key", () => {
    expect(resolveTeleprompterAction(input("Unidentified", "PageDown"), automatic)).toBe(
      "forward"
    );
  });
});

describe("learned pedal mapping", () => {
  it("stores and describes a physical key code", () => {
    const binding = bindingFromKeyboardInput(input("MediaTrackNext", "MediaTrackNext"));
    expect(binding).toBe("code:MediaTrackNext");
    if (binding === null) {
      throw new Error("Expected a usable media key binding");
    }
    expect(describeBinding(binding)).toBe("MediaTrackNext");
    expect(matchesBinding(input("x", "MediaTrackNext"), binding)).toBe(true);
  });

  it("stores event.key when iOS reports code as unidentified", () => {
    expect(bindingFromKeyboardInput(input("PageDown", "Unidentified"))).toBe("key:PageDown");
    expect(bindingFromKeyboardInput(input("Unidentified", "Unidentified"))).toBeNull();
  });

  it("describes the complete event for pedal diagnostics", () => {
    expect(describeKeyboardInput(input("PageDown", "Unidentified"))).toBe(
      "Received key: PageDown · code: Unidentified"
    );
  });

  it("uses learned keys and disables automatic keys only for that pedal", () => {
    const settings = {
      leftPedalBinding: "code:KeyA",
      rightPedalBinding: null
    };

    expect(resolveTeleprompterAction(input("a", "KeyA"), settings)).toBe("reverse");
    expect(resolveTeleprompterAction(input("ArrowLeft"), settings)).toBeNull();
    expect(resolveTeleprompterAction(input("ArrowDown"), settings)).toBe("forward");
  });
});
