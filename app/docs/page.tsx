import { ExternalLink, Globe2, Network, Rocket, Server } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DocCardItem = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  badgeVariant: "default" | "secondary" | "outline";
  external?: boolean;
  footerLabel?: string;
  actionLabel?: string;
  featured?: boolean;
};

export default async function DocsPage() {
  const t = await getTranslations("docs");

  const featuredCards: DocCardItem[] = [
    {
      title: "rauto.top",
      description: t("officialWebsiteDescription"),
      href: "https://rauto.top",
      icon: Globe2,
      badge: t("officialWebsiteBadge"),
      badgeVariant: "default",
      external: true,
      footerLabel: t("officialWebsiteTag"),
      actionLabel: t("openOfficialWebsite"),
      featured: true,
    },
    {
      title: "rauto-manager",
      description: t("managerCardDescription"),
      href: "https://github.com/demohiiiii/rauto-manager",
      icon: Rocket,
      badge: t("repoBadge"),
      badgeVariant: "default",
      external: true,
    },
    {
      title: "rauto",
      description: t("rautoCardDescription"),
      href: "https://github.com/demohiiiii/rauto",
      icon: Server,
      badge: t("repoBadge"),
      badgeVariant: "secondary",
      external: true,
    },
    {
      title: "rneter",
      description: t("rneterCardDescription"),
      href: "https://github.com/demohiiiii/rneter",
      icon: Network,
      badge: t("repoBadge"),
      badgeVariant: "secondary",
      external: true,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            {t("cardPageSubtitle")}
          </p>
        </div>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {t("featuredProjectsTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("featuredProjectsDescription")}
            </p>
          </div>

          <div className="grid items-stretch gap-4 sm:grid-cols-2">
            {featuredCards.map((item, index) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.title}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-full"
                >
                  <Card
                    className={`group flex h-full flex-col transition-colors animate-fade-in stagger-${Math.min(
                      index + 1,
                      4,
                    )} ${
                      item.featured
                        ? "border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10"
                        : "border-border/70 bg-card hover:bg-accent/40"
                    }`}
                  >
                    <CardHeader className="flex-1 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <Badge variant={item.badgeVariant}>{item.badge}</Badge>
                      </div>
                      <div className="space-y-2">
                        <CardTitle className="text-xl">{item.title}</CardTitle>
                        <CardDescription className="text-sm leading-6">
                          {item.description}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {item.footerLabel ?? t("relatedProjectTag")}
                      </span>
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                        {item.actionLabel ?? t("openExternal")}
                        <ExternalLink className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
