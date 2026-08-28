export type ScrollDirection = -1 | 1;

export type MotionState = "paused" | "forward" | "reverse";

export type TeleprompterAction = "forward" | "reverse" | "toggle" | "pause";

export interface TeleprompterSettings {
  speed: number;
  fontSize: number;
  lineHeight: number;
  mirrorHorizontally: boolean;
  mirrorVertically: boolean;
  keepAwake: boolean;
  leftPedalBinding: string | null;
  rightPedalBinding: string | null;
}

export const DEFAULT_SETTINGS: TeleprompterSettings = {
  speed: 36,
  fontSize: 44,
  lineHeight: 1.35,
  mirrorHorizontally: false,
  mirrorVertically: false,
  keepAwake: true,
  leftPedalBinding: null,
  rightPedalBinding: null
};

export function mergeSettings(
  stored: Partial<TeleprompterSettings> | null | undefined
): TeleprompterSettings {
  return {
    speed: validNumber(stored?.speed, DEFAULT_SETTINGS.speed, 4, 160),
    fontSize: validNumber(stored?.fontSize, DEFAULT_SETTINGS.fontSize, 24, 96),
    lineHeight: validNumber(stored?.lineHeight, DEFAULT_SETTINGS.lineHeight, 1, 2),
    mirrorHorizontally: validBoolean(
      stored?.mirrorHorizontally,
      DEFAULT_SETTINGS.mirrorHorizontally
    ),
    mirrorVertically: validBoolean(stored?.mirrorVertically, DEFAULT_SETTINGS.mirrorVertically),
    keepAwake: validBoolean(stored?.keepAwake, DEFAULT_SETTINGS.keepAwake),
    leftPedalBinding: validBinding(stored?.leftPedalBinding),
    rightPedalBinding: validBinding(stored?.rightPedalBinding)
  };
}

function validNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function validBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function validBinding(value: unknown): string | null {
  return typeof value === "string" &&
    /^(code|key|keyCode|keyIdentifier):.+$/.test(value) &&
    value !== "code:Unidentified" &&
    value !== "key:Unidentified"
    ? value
    : null;
}
