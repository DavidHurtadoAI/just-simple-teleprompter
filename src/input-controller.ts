import type {
  TeleprompterAction,
  TeleprompterSettings
} from "./types";

const AUTOMATIC_FORWARD_KEYS = new Set(["ArrowDown"]);
const AUTOMATIC_REVERSE_KEYS = new Set(["ArrowUp"]);
const IOS_KEY_ALIASES = new Map([
  ["UIKeyInputRightArrow", "ArrowRight"],
  ["UIKeyInputDownArrow", "ArrowDown"],
  ["UIKeyInputLeftArrow", "ArrowLeft"],
  ["UIKeyInputUpArrow", "ArrowUp"]
]);
const LEGACY_KEY_CODES = new Map([
  [27, "Escape"],
  [32, "Space"],
  [33, "PageUp"],
  [34, "PageDown"],
  [37, "ArrowLeft"],
  [38, "ArrowUp"],
  [39, "ArrowRight"],
  [40, "ArrowDown"]
]);

export interface KeyboardInput {
  key: string;
  code: string;
  repeat: boolean;
  keyCode?: number;
  which?: number;
  keyIdentifier?: string;
}

type KeyboardIdentity = Pick<
  KeyboardInput,
  "key" | "code" | "keyCode" | "which" | "keyIdentifier"
>;

export function bindingFromKeyboardInput(
  input: KeyboardIdentity
): string | null {
  if (isIdentifiedValue(input.code)) {
    return `code:${input.code}`;
  }
  if (isIdentifiedValue(input.key)) {
    return `key:${input.key}`;
  }
  const legacyCode = legacyKeyCode(input);
  if (legacyCode !== null) {
    return `keyCode:${legacyCode}`;
  }
  if (isIdentifiedValue(input.keyIdentifier ?? "")) {
    return `keyIdentifier:${input.keyIdentifier}`;
  }
  return null;
}

export function describeBinding(binding: string | null): string {
  if (binding === null) {
    return "Built-in keys";
  }
  const separator = binding.indexOf(":");
  return separator === -1 ? binding : binding.slice(separator + 1);
}

export function matchesBinding(input: KeyboardIdentity, binding: string): boolean {
  const legacyCode = legacyKeyCode(input);
  return (
    binding === `code:${input.code}` ||
    binding === `key:${input.key}` ||
    (legacyCode !== null && binding === `keyCode:${legacyCode}`) ||
    binding === `keyIdentifier:${input.keyIdentifier ?? ""}`
  );
}

export function describeKeyboardInput(input: KeyboardInput): string {
  const key = input.key || "(empty)";
  const code = input.code || "(empty)";
  const legacyCode = legacyKeyCode(input);
  const legacyDescription = legacyCode === null ? "" : ` · keyCode: ${legacyCode}`;
  const identifierDescription = isIdentifiedValue(input.keyIdentifier ?? "")
    ? ` · keyIdentifier: ${input.keyIdentifier}`
    : "";
  return `Received key: ${key} · code: ${code}${legacyDescription}${identifierDescription}${input.repeat ? " · repeat" : ""}`;
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

function normalizedKey(input: KeyboardIdentity): string {
  if (input.code === "Space" || input.key === " ") {
    return "Space";
  }

  const key = IOS_KEY_ALIASES.get(input.key) ?? input.key;
  if (isIdentifiedValue(key)) {
    return key;
  }
  const code = IOS_KEY_ALIASES.get(input.code) ?? input.code;
  if (isIdentifiedValue(code)) {
    return code;
  }
  return LEGACY_KEY_CODES.get(legacyKeyCode(input) ?? -1) ?? code;
}

function legacyKeyCode(input: Pick<KeyboardInput, "keyCode" | "which">): number | null {
  const value = input.keyCode || input.which || 0;
  return Number.isInteger(value) && value > 0 ? value : null;
}

function isIdentifiedValue(value: string): boolean {
  return value.length > 0 && value !== "Unidentified";
}
