import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText, ListTree } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { MarkdownArticle, extractHeadings } from "@/components/docs/markdown-article";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getLocalDocBySlug,
  listLocalDocs,
  type DocCategory,
} from "@/lib/docs";

export const runtime = "nodejs";

export async function generateStaticParams() {
  const docs = await listLocalDocs();
  return docs.map((doc) => ({ slug: doc.slug }));
}

function formatDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, t, locale, docs] = await Promise.all([
    params,
    getTranslations("docs"),
    getLocale(),
    listLocalDocs(),
  ]);

  const doc = await getLocalDocBySlug(slug);
  if (!doc) {
    notFound();
  }

  const headings = extractHeadings(doc.content);

  const categoryLabels: Record<DocCategory, string> = {
    guide: t("categoryGuide"),
    roadmap: t("categoryRoadmap"),
    reference: t("categoryReference"),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="px-0 hover:bg-transparent">
            <Link href="/docs">
              <ArrowLeft className="h-4 w-4" />
              {t("detailBack")}
            </Link>
          </Button>
        </div>

        <Card className="border-border/70">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{categoryLabels[doc.category]}</Badge>
              <Badge variant="outline">
                {doc.locale === "zh" ? t("languageChinese") : t("languageEnglish")}
              </Badge>
            </div>
            <div className="space-y-3">
              <CardTitle className="text-3xl leading-tight">{doc.title}</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-7">
                {doc.summary || t("noSummary")}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>
                {t("sourcePath")}: <code>{doc.relativePath}</code>
              </span>
              <span>
                {t("updatedAt")}: {formatDate(doc.updatedAt, locale)}
              </span>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle>{t("detailContent")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <MarkdownArticle
                content={doc.content}
                currentAbsolutePath={doc.absolutePath}
                docs={docs}
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ListTree className="h-4 w-4 text-primary" />
                  <CardTitle>{t("detailOutline")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {headings.length ? (
                  <nav className="space-y-1">
                    {headings.map((heading) => (
                      <a
                        key={heading.id}
                        href={`#${heading.id}`}
                        className={`block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
                          heading.level === 3 ? "ml-4" : ""
                        }`}
                      >
                        {heading.text}
                      </a>
                    ))}
                  </nav>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("emptyOutline")}</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("moreDocsTitle")}</CardTitle>
                <CardDescription>{t("moreDocsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {docs
                  .filter((item) => item.slug !== doc.slug)
                  .slice(0, 5)
                  .map((item) => (
                    <Link
                      key={item.slug}
                      href={`/docs/${item.slug}`}
                      className="group flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {item.summary || t("noSummary")}
                        </p>
                      </div>
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
