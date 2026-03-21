import Link from "next/link";

import {
  type LocalDocSummary,
  resolveDocHref,
  resolveImageSrc,
} from "@/lib/docs";

type MarkdownArticleProps = {
  content: string;
  currentAbsolutePath: string;
  docs: LocalDocSummary[];
};

type MarkdownBlock =
  | { type: "heading"; level: number; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code"; language: string; content: string }
  | { type: "image"; alt: string; src: string }
  | { type: "table"; rows: string[][] }
  | { type: "separator" };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`~!@#$%^&*()+={}\[\]|\\:;"'<>,.?/]+/g, "")
    .replace(/\s+/g, "-");
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  return /^\|?[\s:-|]+\|?$/.test(line.trim());
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      blocks.push({ type: "image", alt: imageMatch[1], src: imageMatch[2] });
      index += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push({ type: "separator" });
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const text = headingMatch[2].trim();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text,
        id: slugify(text),
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        type: "code",
        language,
        content: codeLines.join("\n"),
      });
      continue;
    }

    if (
      trimmed.startsWith("|") &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      const rows = [parseTableRow(lines[index])];
      index += 2;

      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }

      blocks.push({ type: "table", rows });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      const currentTrimmed = current.trim();
      if (
        !currentTrimmed ||
        currentTrimmed === "---" ||
        /^!\[/.test(currentTrimmed) ||
        /^(#{1,6})\s+/.test(currentTrimmed) ||
        currentTrimmed.startsWith("```") ||
        /^>\s?/.test(currentTrimmed) ||
        /^[-*]\s+/.test(currentTrimmed) ||
        /^\d+\.\s+/.test(currentTrimmed) ||
        (currentTrimmed.startsWith("|") &&
          index + 1 < lines.length &&
          isTableSeparator(lines[index + 1]))
      ) {
        break;
      }

      paragraphLines.push(currentTrimmed);
      index += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInline(
  text: string,
  currentAbsolutePath: string,
  docs: LocalDocSummary[],
  keyPrefix: string,
) {
  const nodes: React.ReactNode[] = [];
  const tokenPattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const [token] = match;
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-${start}`}
          className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-${start}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!linkMatch) {
        nodes.push(token);
      } else {
        const label = linkMatch[1];
        const href = linkMatch[2];
        const internalHref = resolveDocHref(docs, currentAbsolutePath, href);
        if (internalHref?.startsWith("/docs/")) {
          nodes.push(
            <Link
              key={`${keyPrefix}-${start}`}
              href={internalHref}
              className="text-primary underline underline-offset-4"
            >
              {label}
            </Link>,
          );
        } else if (/^https?:\/\//i.test(href)) {
          nodes.push(
            <a
              key={`${keyPrefix}-${start}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-4"
            >
              {label}
            </a>,
          );
        } else {
          nodes.push(label);
        }
      }
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function HeadingTag({
  level,
  id,
  children,
}: {
  level: number;
  id: string;
  children: React.ReactNode;
}) {
  if (level === 1) {
    return (
      <h1 id={id} className="scroll-mt-24 text-3xl font-semibold tracking-tight text-foreground">
        {children}
      </h1>
    );
  }

  if (level === 2) {
    return (
      <h2
        id={id}
        className="scroll-mt-24 border-t border-border/60 pt-6 text-2xl font-semibold tracking-tight text-foreground"
      >
        {children}
      </h2>
    );
  }

  if (level === 3) {
    return (
      <h3 id={id} className="scroll-mt-24 text-xl font-semibold text-foreground">
        {children}
      </h3>
    );
  }

  if (level === 4) {
    return (
      <h4 id={id} className="scroll-mt-24 text-lg font-semibold text-foreground">
        {children}
      </h4>
    );
  }

  return (
    <h5 id={id} className="scroll-mt-24 text-base font-semibold text-foreground">
      {children}
    </h5>
  );
}

export function MarkdownArticle({
  content,
  currentAbsolutePath,
  docs,
}: MarkdownArticleProps) {
  const blocks = parseMarkdown(content);

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "heading") {
          return (
            <HeadingTag key={key} level={block.level} id={block.id}>
              {renderInline(block.text, currentAbsolutePath, docs, key)}
            </HeadingTag>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={key} className="text-sm leading-7 text-foreground/90 sm:text-base">
              {renderInline(block.text, currentAbsolutePath, docs, key)}
            </p>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={key}
              className="rounded-r-lg border-l-4 border-primary/40 bg-muted/40 px-4 py-3 text-sm italic text-muted-foreground"
            >
              {block.lines.map((line, lineIndex) => (
                <p key={`${key}-${lineIndex}`}>
                  {renderInline(line, currentAbsolutePath, docs, `${key}-${lineIndex}`)}
                </p>
              ))}
            </blockquote>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul key={key} className="space-y-2 pl-5 text-sm leading-7 text-foreground/90 sm:text-base">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="list-disc">
                  {renderInline(item, currentAbsolutePath, docs, `${key}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol key={key} className="space-y-2 pl-5 text-sm leading-7 text-foreground/90 sm:text-base">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="list-decimal">
                  {renderInline(item, currentAbsolutePath, docs, `${key}-${itemIndex}`)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "code") {
          return (
            <div key={key} className="overflow-hidden rounded-xl border border-border/70 bg-card">
              {block.language ? (
                <div className="border-b border-border/70 bg-muted/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {block.language}
                </div>
              ) : null}
              <pre className="overflow-x-auto p-4 text-sm leading-6 text-foreground">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        if (block.type === "image") {
          const src = resolveImageSrc(currentAbsolutePath, block.src);
          if (!src) {
            return null;
          }

          return (
            <figure key={key} className="overflow-hidden rounded-xl border border-border/70 bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={block.alt}
                className="h-auto w-full object-cover"
              />
              {block.alt ? (
                <figcaption className="border-t border-border/70 px-4 py-3 text-sm text-muted-foreground">
                  {block.alt}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (block.type === "table") {
          const [header, ...rows] = block.rows;

          return (
            <div key={key} className="overflow-x-auto rounded-xl border border-border/70">
              <table className="min-w-full divide-y divide-border/70 text-left text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {header.map((cell, cellIndex) => (
                      <th key={`${key}-head-${cellIndex}`} className="px-4 py-3 font-semibold text-foreground">
                        {renderInline(cell, currentAbsolutePath, docs, `${key}-head-${cellIndex}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-card">
                  {rows.map((row, rowIndex) => (
                    <tr key={`${key}-row-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${key}-row-${rowIndex}-${cellIndex}`}
                          className="px-4 py-3 align-top text-foreground/90"
                        >
                          {renderInline(cell, currentAbsolutePath, docs, `${key}-row-${rowIndex}-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return <hr key={key} className="border-border/70" />;
      })}
    </div>
  );
}

export function extractHeadings(content: string) {
  return parseMarkdown(content)
    .filter((block): block is Extract<MarkdownBlock, { type: "heading" }> => block.type === "heading")
    .filter((heading) => heading.level <= 3)
    .map((heading) => ({
      id: heading.id,
      level: heading.level,
      text: heading.text,
    }));
}
