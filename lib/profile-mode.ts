import type { DeviceProfileModes } from "@/lib/types";

export const AUTO_PROFILE_MODE = "__auto__";

export interface InvalidProfileModeError {
  requestedMode: string;
  profile: string;
  defaultMode: string;
  availableModes: string[];
}

const INVALID_PROFILE_MODE_PATTERN =
  /invalid mode '([^']+)' for profile '([^']+)'; default_mode='([^']+)'; available_modes=\[([^\]]*)\]/i;

export function normalizeDeviceProfileModes(
  data: DeviceProfileModes | null | undefined
): DeviceProfileModes | null {
  if (!data) {
    return null;
  }

  return {
    name: String(data.name ?? ""),
    default_mode: String(data.default_mode ?? ""),
    modes: Array.isArray(data.modes)
      ? data.modes.filter((mode): mode is string => typeof mode === "string")
      : [],
  };
}

export function parseInvalidProfileModeError(
  message: string
): InvalidProfileModeError | null {
  const match = message.match(INVALID_PROFILE_MODE_PATTERN);
  if (!match) {
    return null;
  }

  const [, requestedMode, profile, defaultMode, modesText] = match;

  return {
    requestedMode,
    profile,
    defaultMode,
    availableModes: modesText
      .split(",")
      .map((mode) => mode.trim())
      .filter(Boolean),
  };
}
