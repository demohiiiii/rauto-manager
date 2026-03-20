import type { DispatchType } from "@/lib/types";

const DEFAULT_RECORD_LEVEL_MAP: Partial<
  Record<DispatchType, "Off" | "KeyEventsOnly" | "Full">
> = {
  tx_block: "KeyEventsOnly",
  tx_workflow: "KeyEventsOnly",
  orchestrate: "KeyEventsOnly",
};

export function getDefaultRecordLevelForType(
  type: DispatchType
): "Off" | "KeyEventsOnly" | "Full" {
  return DEFAULT_RECORD_LEVEL_MAP[type] ?? "Off";
}
