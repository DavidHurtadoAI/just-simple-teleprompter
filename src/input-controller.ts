import type {
  TeleprompterAction,
  TeleprompterSettings
} from "./types";

const AUTOMATIC_FORWARD_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown"]);
const AUTOMATIC_REVERSE_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp"]);
const IOS_KEY_ALIASES = new Map([
  ["UIKeyInputRightArrow", "ArrowRight"],
  ["UIKeyInputDownArrow", "ArrowDown"],
  ["UIKeyInputLeftArrow", "ArrowLeft"],
  ["UIKeyInputUpArrow", "ArrowUp"]
]);

export interface KeyboardInput {
  key: string;
  code: string;
  repeat: boolean;
}

export function bindingFromKeyboardInput(
  input: Pick<KeyboardInput, "key" | "code">
): string | null {
  if (isIdentifiedValue(input.code)) {
    return `code:${input.code}`;
  }
  if (isIdentifiedValue(input.key)) {
    return `key:${input.key}`;
  }
  return null;
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

export function describeKeyboardInput(input: KeyboardInput): string {
  const key = input.key || "(empty)";
  const code = input.code || "(empty)";
  return `Received key: ${key} · code: ${code}${input.repeat ? " · repeat" : ""}`;
}

export function resolveTeleprompterAction(
  input: KeyboardInput,
  settings: Pick<TeleprompterSettings, "leftPedalBinding" | "rightPedalBinding">
): TeleprompterAction | null {
  if (input.repeat) {
    return null;
  }

  const key = normalizedKey(input);

  if (key === "Space") {
    return "toggle";
  }

  if (key === "Escape") {
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

  if (customLeft === null && AUTOMATIC_REVERSE_KEYS.has(key)) {
    return "reverse";
  }

  if (customRight === null && AUTOMATIC_FORWARD_KEYS.has(key)) {
    return "forward";
  }

  return null;
}

function normalizedKey(input: Pick<KeyboardInput, "key" | "code">): string {
  if (input.code === "Space" || input.key === " ") {
    return "Space";
  }

  const key = IOS_KEY_ALIASES.get(input.key) ?? input.key;
  if (isIdentifiedValue(key)) {
    return key;
  }
  return IOS_KEY_ALIASES.get(input.code) ?? input.code;
}

function isIdentifiedValue(value: string): boolean {
  return value.length > 0 && value !== "Unidentified";
}
