import type { DispatchType, RecordLevel } from "@/lib/types";

const DEFAULT_RECORD_LEVEL_MAP: Partial<Record<DispatchType, RecordLevel>> = {
  tx_block: "KeyEventsOnly",
  tx_workflow: "KeyEventsOnly",
  orchestrate: "KeyEventsOnly",
  exec: "KeyEventsOnly",
  template: "KeyEventsOnly",
};

export function normalizeRecordLevel(value: unknown): RecordLevel | undefined {
  if (value === "Full") {
    return "Full";
  }

  if (value === "KeyEventsOnly") {
    return "KeyEventsOnly";
  }

  return undefined;
}

export function getDefaultRecordLevelForType(type: DispatchType): RecordLevel {
  return DEFAULT_RECORD_LEVEL_MAP[type] ?? "KeyEventsOnly";
}
