import { randomUUID } from "node:crypto";
import type { AgentTemplateKind, ManagerTemplate } from "@/lib/types";
import { prisma } from "@/lib/prisma";

interface ManagerTemplateRow {
  id: string;
  kind: string;
  name: string;
  content: string;
  sourceAgentId: string | null;
  sourceAgentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpsertManagerTemplateInput {
  kind: AgentTemplateKind;
  name: string;
  content: string;
  sourceAgentId?: string | null;
  sourceAgentName?: string | null;
}

function toManagerTemplate(row: ManagerTemplateRow): ManagerTemplate {
  return {
    id: row.id,
    kind: row.kind as AgentTemplateKind,
    name: row.name,
    content: row.content,
    sourceAgentId: row.sourceAgentId,
    sourceAgentName: row.sourceAgentName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listManagerTemplates(
  kind?: AgentTemplateKind,
): Promise<ManagerTemplate[]> {
  const rows = kind
    ? await prisma.$queryRaw<ManagerTemplateRow[]>`
        SELECT * FROM "ManagerTemplate"
        WHERE "kind" = ${kind}
        ORDER BY "updatedAt" DESC
      `
    : await prisma.$queryRaw<ManagerTemplateRow[]>`
        SELECT * FROM "ManagerTemplate"
        ORDER BY "updatedAt" DESC
      `;

  return rows.map(toManagerTemplate);
}

export async function getManagerTemplateById(
  id: string,
): Promise<ManagerTemplate | null> {
  const rows = await prisma.$queryRaw<ManagerTemplateRow[]>`
    SELECT * FROM "ManagerTemplate"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  return rows[0] ? toManagerTemplate(rows[0]) : null;
}

export async function upsertManagerTemplate(
  input: UpsertManagerTemplateInput,
): Promise<ManagerTemplate> {
  const rows = await prisma.$queryRaw<ManagerTemplateRow[]>`
    INSERT INTO "ManagerTemplate" (
      "id",
      "kind",
      "name",
      "content",
      "sourceAgentId",
      "sourceAgentName",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${randomUUID()},
      ${input.kind},
      ${input.name},
      ${input.content},
      ${input.sourceAgentId ?? null},
      ${input.sourceAgentName ?? null},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("kind", "name") DO UPDATE SET
      "content" = EXCLUDED."content",
      "sourceAgentId" = EXCLUDED."sourceAgentId",
      "sourceAgentName" = EXCLUDED."sourceAgentName",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `;

  return toManagerTemplate(rows[0]);
}
