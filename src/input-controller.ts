import type {
  TeleprompterAction,
  TeleprompterSettings
} from "./types";

const AUTOMATIC_FORWARD_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown"]);
const AUTOMATIC_REVERSE_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp"]);

export interface KeyboardInput {
  key: string;
  code: string;
  repeat: boolean;
}

export function bindingFromKeyboardInput(input: Pick<KeyboardInput, "key" | "code">): string {
  if (input.code) {
    return `code:${input.code}`;
  }
  return `key:${input.key}`;
}

export function describeBinding(binding: string | null): string {
  if (binding === null) {
    return "Automatic";
  }
  const separator = binding.indexOf(":");
  return separator === -1 ? binding : binding.slice(separator + 1);
}

export function matchesBinding(input: Pick<KeyboardInput, "key" | "code">, binding: string): boolean {
  return binding === `code:${input.code}` || binding === `key:${input.key}`;
}

export function resolveTeleprompterAction(
  input: KeyboardInput,
  settings: Pick<TeleprompterSettings, "leftPedalBinding" | "rightPedalBinding">
): TeleprompterAction | null {
  if (input.repeat) {
    return null;
  }

  if (input.code === "Space" || input.key === " ") {
    return "toggle";
  }

  if (input.key === "Escape") {
    return "pause";
  }

  const customLeft = settings.leftPedalBinding;
  const customRight = settings.rightPedalBinding;

  if (customLeft !== null && matchesBinding(input, customLeft)) {
    return "reverse";
  }

  if (customRight !== null && matchesBinding(input, customRight)) {
    return "forward";
  }

  if (customLeft === null && AUTOMATIC_REVERSE_KEYS.has(input.key)) {
    return "reverse";
  }

  if (customRight === null && AUTOMATIC_FORWARD_KEYS.has(input.key)) {
    return "forward";
  }

  return null;
}

