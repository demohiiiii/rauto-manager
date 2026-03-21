import { promises as fs } from "fs";
import path from "path";

export type DocCategory = "guide" | "roadmap" | "reference";
export type DocLocale = "en" | "zh";

export interface LocalDocSummary {
  slug: string;
  title: string;
  summary: string;
  absolutePath: string;
  relativePath: string;
  category: DocCategory;
  locale: DocLocale;
  updatedAt: string;
}

export interface LocalDoc extends LocalDocSummary {
  content: string;
}

export interface ScreenshotItem {
  key: string;
  fileName: string;
}

const MANAGER_ROOT = process.cwd();
const WORKSPACE_ROOT = path.resolve(MANAGER_ROOT, "..");
const WORKSPACE_DOCS_ROOT = path.join(WORKSPACE_ROOT, "docs");
const MANAGER_SCREENSHOTS_ROOT = path.join(MANAGER_ROOT, "docs", "screenshots");

const STATIC_DOCS: Array<{
  slug: string;
  absolutePath: string;
  category: DocCategory;
  locale: DocLocale;
}> = [
  {
    slug: "manager-overview",
    absolutePath: path.join(MANAGER_ROOT, "README.md"),
    category: "guide",
    locale: "en",
  },
  {
    slug: "manager-overview-zh",
    absolutePath: path.join(MANAGER_ROOT, "README_zh.md"),
    category: "guide",
    locale: "zh",
  },
];

export const DOC_SCREENSHOTS: ScreenshotItem[] = [
  { key: "dashboard", fileName: "dashboard-overview.png" },
  { key: "agentRegistration", fileName: "agent-registration.png" },
  { key: "deviceOnboarding", fileName: "device-onboarding.png" },
  { key: "taskDispatch", fileName: "task-dispatch.png" },
  { key: "taskResults", fileName: "task-results.png" },
];

function toRelativePath(absolutePath: string) {
  return path.relative(WORKSPACE_ROOT, absolutePath) || path.basename(absolutePath);
}

function slugFromFileName(fileName: string) {
  return fileName.replace(/\.md$/i, "");
}

function extractTitle(content: string, fallback: string) {
  const headingLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line));

  return headingLine ? headingLine.replace(/^#\s+/, "").trim() : fallback;
}

function extractSummary(content: string) {
  const lines = content.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("```")) continue;
    if (line.startsWith("![")) continue;
    if (line.startsWith("|")) continue;
    if (line === "---") continue;
    if (/^\d+\.\s+/.test(line)) continue;
    if (/^[-*]\s+/.test(line)) continue;
    return line.replace(/^>\s?/, "");
  }

  return "";
}

async function getWorkspaceDocs() {
  try {
    const entries = await fs.readdir(WORKSPACE_DOCS_ROOT, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => ({
        slug: slugFromFileName(entry.name),
        absolutePath: path.join(WORKSPACE_DOCS_ROOT, entry.name),
        category: "roadmap" as const,
        locale: entry.name.toLowerCase().includes("-zh") ? ("zh" as const) : ("en" as const),
      }));
  } catch {
    return [];
  }
}

async function buildDocSummary(source: {
  slug: string;
  absolutePath: string;
  category: DocCategory;
  locale: DocLocale;
}): Promise<LocalDocSummary | null> {
  try {
    const [content, stat] = await Promise.all([
      fs.readFile(source.absolutePath, "utf8"),
      fs.stat(source.absolutePath),
    ]);

    return {
      slug: source.slug,
      title: extractTitle(content, source.slug),
      summary: extractSummary(content),
      absolutePath: source.absolutePath,
      relativePath: toRelativePath(source.absolutePath),
      category: source.category,
      locale: source.locale,
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function listLocalDocs() {
  const workspaceDocs = await getWorkspaceDocs();
  const docs = await Promise.all(
    [...STATIC_DOCS, ...workspaceDocs].map((source) => buildDocSummary(source)),
  );

  return docs
    .filter((doc): doc is LocalDocSummary => doc !== null)
    .sort((left, right) => {
      if (left.category !== right.category) {
        const order: Record<DocCategory, number> = {
          guide: 0,
          roadmap: 1,
          reference: 2,
        };
        return order[left.category] - order[right.category];
      }

      return left.title.localeCompare(right.title);
    });
}

export async function getLocalDocBySlug(slug: string) {
  const docs = await listLocalDocs();
  const doc = docs.find((item) => item.slug === slug);

  if (!doc) {
    return null;
  }

  const content = await fs.readFile(doc.absolutePath, "utf8");
  return {
    ...doc,
    content,
  } satisfies LocalDoc;
}

export function getPreferredGuideSlug(locale: string) {
  return locale.startsWith("zh") ? "manager-overview-zh" : "manager-overview";
}

export function getScreenshotAssetPath(fileName: string) {
  return `/api/docs-assets/screenshots/${fileName}`;
}

export function getScreenshotAbsolutePath(fileName: string) {
  return path.join(MANAGER_SCREENSHOTS_ROOT, fileName);
}

export function resolveDocHref(
  docs: LocalDocSummary[],
  currentAbsolutePath: string,
  href: string,
) {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  const cleanHref = href.split("#")[0];
  const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";

  const candidates = [
    cleanHref,
    path.resolve(path.dirname(currentAbsolutePath), cleanHref),
  ];

  const normalizedDocs = docs.map((doc) => ({
    slug: doc.slug,
    absolutePath: path.resolve(doc.absolutePath),
  }));

  for (const candidate of candidates) {
    const matched = normalizedDocs.find(
      (doc) => doc.absolutePath === path.resolve(candidate),
    );
    if (matched) {
      return `/docs/${matched.slug}${hash}`;
    }
  }

  return null;
}

export function resolveImageSrc(currentAbsolutePath: string, src: string) {
  if (/^https?:\/\//i.test(src)) {
    return src;
  }

  const absolutePath = path.resolve(path.dirname(currentAbsolutePath), src);

  if (
    absolutePath === MANAGER_SCREENSHOTS_ROOT ||
    absolutePath.startsWith(`${MANAGER_SCREENSHOTS_ROOT}${path.sep}`)
  ) {
    return `/api/docs-assets/screenshots/${path.basename(absolutePath)}`;
  }

  return null;
}
