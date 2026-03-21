import {
  ArrowRight,
  ExternalLink,
  History,
  Network,
  Rocket,
  Server,
} from "lucide-react";
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
};

export default async function DocsPage() {
  const t = await getTranslations("docs");

  const featuredCards: DocCardItem[] = [
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
            <a
              href={featuredCards[0].href}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Card className="group h-full overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm transition-colors hover:border-primary/35 hover:bg-accent/30">
                <CardHeader className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                      <Rocket className="h-6 w-6" />
                    </div>
                    <Badge variant="default">{featuredCards[0].badge}</Badge>
                  </div>
                  <div className="space-y-3">
                    <CardTitle className="text-2xl tracking-tight">{featuredCards[0].title}</CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-7 text-foreground/75">
                      {featuredCards[0].description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: Rocket, label: t("managerFeatureDeploy") },
                      { icon: Server, label: t("managerFeatureAgents") },
                      { icon: History, label: t("managerFeatureHistory") },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-medium text-foreground/90">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                    {t("openExternal")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </a>

            <div className="grid gap-4">
              {featuredCards.slice(1).map((item, index) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.title}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <Card
                      className={`group h-full border-border/70 bg-card transition-colors hover:bg-accent/40 animate-fade-in stagger-${Math.min(
                        index + 2,
                        4,
                      )}`}
                    >
                      <CardHeader className="space-y-4">
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
                          {t("relatedProjectTag")}
                        </span>
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                          {t("openExternal")}
                          <ExternalLink className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
