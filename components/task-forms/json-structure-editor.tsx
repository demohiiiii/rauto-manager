"use client";

import { Trash2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type StructuredJsonPrimitive = string | number | boolean | null;
export type StructuredJsonValue =
  | StructuredJsonPrimitive
  | StructuredJsonObject
  | StructuredJsonArray;
export interface StructuredJsonObject {
  [key: string]: StructuredJsonValue;
}
export type StructuredJsonArray = StructuredJsonValue[];

type JsonValueKind =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeStructuredJsonValue(value: unknown): StructuredJsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStructuredJsonValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        sanitizeStructuredJsonValue(entryValue),
      ]),
    );
  }

  return "";
}

export function toStructuredJsonObject(value: unknown): StructuredJsonObject {
  const normalized = sanitizeStructuredJsonValue(value);
  return isPlainObject(normalized) ? (normalized as StructuredJsonObject) : {};
}

export function toStructuredJsonArray(value: unknown): StructuredJsonArray {
  const normalized = sanitizeStructuredJsonValue(value);
  return Array.isArray(normalized) ? normalized : [];
}

export function parseStructuredJsonObjectString(
  value: string | null | undefined,
): StructuredJsonObject {
  if (!value?.trim()) {
    return {};
  }

  try {
    return toStructuredJsonObject(JSON.parse(value));
  } catch {
    return {};
  }
}

export function parseStructuredJsonArrayString(
  value: string | null | undefined,
): StructuredJsonArray {
  if (!value?.trim()) {
    return [];
  }

  try {
    return toStructuredJsonArray(JSON.parse(value));
  } catch {
    return [];
  }
}

export function stringifyStructuredJsonValue(
  value: StructuredJsonValue,
  options?: { blankWhenEmpty?: boolean },
): string {
  if (options?.blankWhenEmpty) {
    if (Array.isArray(value) && value.length === 0) {
      return "";
    }

    if (isPlainObject(value) && Object.keys(value).length === 0) {
      return "";
    }
  }

  return JSON.stringify(value, null, 2);
}

function getValueKind(value: StructuredJsonValue): JsonValueKind {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (isPlainObject(value)) {
    return "object";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  return "string";
}

function createDefaultValue(kind: JsonValueKind): StructuredJsonValue {
  switch (kind) {
    case "object":
      return {};
    case "array":
      return [];
    case "number":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    case "string":
    default:
      return "";
  }
}

function getNextObjectKey(value: StructuredJsonObject): string {
  let index = Object.keys(value).length + 1;
  let candidate = `field_${index}`;

  while (Object.prototype.hasOwnProperty.call(value, candidate)) {
    index += 1;
    candidate = `field_${index}`;
  }

  return candidate;
}

function JsonKindSelect({
  value,
  onChange,
}: {
  value: JsonValueKind;
  onChange: (next: JsonValueKind) => void;
}) {
  const t = useTranslations("taskForms");

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as JsonValueKind)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="string">{t("jsonTypeString")}</SelectItem>
        <SelectItem value="number">{t("jsonTypeNumber")}</SelectItem>
        <SelectItem value="boolean">{t("jsonTypeBoolean")}</SelectItem>
        <SelectItem value="object">{t("jsonTypeObject")}</SelectItem>
        <SelectItem value="array">{t("jsonTypeArray")}</SelectItem>
        <SelectItem value="null">{t("jsonTypeNull")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function JsonValueEditor({
  value,
  onChange,
  depth = 0,
}: {
  value: StructuredJsonValue;
  onChange: (next: StructuredJsonValue) => void;
  depth?: number;
}) {
  const t = useTranslations("taskForms");
  const kind = getValueKind(value);
  const nestedCardClass =
    depth === 0
      ? "rounded-xl border bg-muted/20 p-4"
      : "rounded-lg border bg-background/60 p-3";

  if (kind === "object") {
    const entries = Object.entries(value as StructuredJsonObject);

    return (
      <div className={nestedCardClass}>
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {t("jsonObjectEmpty")}
            </div>
          ) : (
            entries.map(([entryKey, entryValue], index) => (
              <div
                key={`${entryKey}-${index}`}
                className="space-y-3 rounded-lg border bg-background/80 p-3"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>{t("jsonFieldKey")}</Label>
                    <Input
                      value={entryKey}
                      onChange={(event) => {
                        const nextKey = event.target.value;
                        const nextEntries = entries.map(
                          ([currentKey, currentValue], currentIndex) =>
                            currentIndex === index
                              ? [nextKey, currentValue]
                              : [currentKey, currentValue],
                        );
                        onChange(Object.fromEntries(nextEntries));
                      }}
                      placeholder={t("jsonFieldKeyPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("jsonValueType")}</Label>
                    <JsonKindSelect
                      value={getValueKind(entryValue)}
                      onChange={(nextKind) => {
                        const nextEntries = entries.map(
                          ([currentKey, currentValue], currentIndex) =>
                            currentIndex === index
                              ? [currentKey, createDefaultValue(nextKind)]
                              : [currentKey, currentValue],
                        );
                        onChange(Object.fromEntries(nextEntries));
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="md:self-end"
                    onClick={() => {
                      const nextEntries = entries.filter(
                        (_, currentIndex) => currentIndex !== index,
                      );
                      onChange(Object.fromEntries(nextEntries));
                    }}
                    aria-label={t("jsonRemoveField")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <JsonValueEditor
                  value={entryValue}
                  onChange={(nextValue) => {
                    const nextEntries = entries.map(
                      ([currentKey, currentValue], currentIndex) =>
                        currentIndex === index
                          ? [currentKey, nextValue]
                          : [currentKey, currentValue],
                    );
                    onChange(Object.fromEntries(nextEntries));
                  }}
                  depth={depth + 1}
                />
              </div>
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange({
                ...(value as StructuredJsonObject),
                [getNextObjectKey(value as StructuredJsonObject)]: "",
              });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("jsonAddField")}
          </Button>
        </div>
      </div>
    );
  }

  if (kind === "array") {
    const items = value as StructuredJsonArray;

    return (
      <div className={nestedCardClass}>
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              {t("jsonArrayEmpty")}
            </div>
          ) : (
            items.map((item, index) => (
              <div
                key={index}
                className="space-y-3 rounded-lg border bg-background/80 p-3"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>{t("jsonArrayItem", { number: index + 1 })}</Label>
                    <div className="h-9 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {t("jsonArrayItemValue")}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("jsonValueType")}</Label>
                    <JsonKindSelect
                      value={getValueKind(item)}
                      onChange={(nextKind) => {
                        onChange(
                          items.map((currentItem, currentIndex) =>
                            currentIndex === index
                              ? createDefaultValue(nextKind)
                              : currentItem,
                          ),
                        );
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="md:self-end"
                    onClick={() => {
                      onChange(
                        items.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      );
                    }}
                    aria-label={t("jsonRemoveItem")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <JsonValueEditor
                  value={item}
                  onChange={(nextValue) => {
                    onChange(
                      items.map((currentItem, currentIndex) =>
                        currentIndex === index ? nextValue : currentItem,
                      ),
                    );
                  }}
                  depth={depth + 1}
                />
              </div>
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange([...(value as StructuredJsonArray), ""]);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("jsonAddItem")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={nestedCardClass}>
      {kind === "string" ? (
        <div className="space-y-2">
          <Label>{t("jsonValue")}</Label>
          <Input
            value={value as string}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t("jsonStringPlaceholder")}
          />
        </div>
      ) : null}
      {kind === "number" ? (
        <div className="space-y-2">
          <Label>{t("jsonValue")}</Label>
          <Input
            inputMode="decimal"
            value={String(value as number)}
            onChange={(event) => {
              const nextValue = event.target.value.trim();
              onChange(nextValue ? Number(nextValue) : 0);
            }}
            placeholder="0"
          />
        </div>
      ) : null}
      {kind === "boolean" ? (
        <div className="flex items-center justify-between rounded-md border px-4 py-3">
          <div className="space-y-0.5">
            <Label>{t("jsonValue")}</Label>
            <p className="text-xs text-muted-foreground">
              {(value as boolean)
                ? t("jsonBooleanTrue")
                : t("jsonBooleanFalse")}
            </p>
          </div>
          <Switch
            checked={value as boolean}
            onCheckedChange={(next) => onChange(next)}
          />
        </div>
      ) : null}
      {kind === "null" ? (
        <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {t("jsonNullValue")}
        </div>
      ) : null}
    </div>
  );
}

export function JsonObjectEditor({
  value,
  onChange,
}: {
  value: StructuredJsonObject;
  onChange: (next: StructuredJsonObject) => void;
}) {
  return (
    <JsonValueEditor
      value={value}
      onChange={(next) => onChange(toStructuredJsonObject(next))}
    />
  );
}

export function JsonArrayEditor({
  value,
  onChange,
}: {
  value: StructuredJsonArray;
  onChange: (next: StructuredJsonArray) => void;
}) {
  return (
    <JsonValueEditor
      value={value}
      onChange={(next) => onChange(toStructuredJsonArray(next))}
    />
  );
}
