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
  keyCode?: number;
  which?: number;
  keyIdentifier?: string;
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

  it("uses legacy numeric key codes when iOS hides both key and code", () => {
    expect(
      resolveTeleprompterAction(
        { ...input("Unidentified", "Unidentified"), keyCode: 34 },
        automatic
      )
    ).toBe("forward");
    expect(
      resolveTeleprompterAction(
        { ...input("Unidentified", "Unidentified"), which: 33 },
        automatic
      )
    ).toBe("reverse");
  });
});

describe("learned pedal mapping", () => {
  it("labels an empty custom binding as the built-in key mode", () => {
    expect(describeBinding(null)).toBe("Built-in keys");
  });

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

  it("learns a numeric or WebKit key identity as a final iOS fallback", () => {
    expect(
      bindingFromKeyboardInput({
        ...input("Unidentified", "Unidentified"),
        keyCode: 34
      })
    ).toBe("keyCode:34");
    expect(
      bindingFromKeyboardInput({
        ...input("Unidentified", "Unidentified"),
        keyIdentifier: "PageDown"
      })
    ).toBe("keyIdentifier:PageDown");
  });

  it("describes the complete event for pedal diagnostics", () => {
    expect(describeKeyboardInput(input("PageDown", "Unidentified"))).toBe(
      "Received key: PageDown · code: Unidentified"
    );
    expect(
      describeKeyboardInput({
        ...input("Unidentified", "Unidentified"),
        keyCode: 34,
        keyIdentifier: "PageDown"
      })
    ).toBe(
      "Received key: Unidentified · code: Unidentified · keyCode: 34 · keyIdentifier: PageDown"
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

  it("matches a learned legacy numeric key code", () => {
    const settings = {
      leftPedalBinding: null,
      rightPedalBinding: "keyCode:34"
    };
    const pageDown = { ...input("Unidentified", "Unidentified"), keyCode: 34 };

    expect(matchesBinding(pageDown, "keyCode:34")).toBe(true);
    expect(resolveTeleprompterAction(pageDown, settings)).toBe("forward");
  });
});
