import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  ExternalLink,
  Terminal,
  Server,
  Network,
  Zap,
  FileText,
  Code2,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

const DOC_ITEMS = [
  { titleKey: "quickStart", descKey: "quickStartDescription", icon: Zap, badgeKey: "quickStartBadge", badgeVariant: "default" as const },
  { titleKey: "agentGuide", descKey: "agentGuideDescription", icon: Server, badgeKey: "coreBadge", badgeVariant: "default" as const },
  { titleKey: "deviceGuide", descKey: "deviceGuideDescription", icon: Network, badgeKey: "coreBadge", badgeVariant: "default" as const },
  { titleKey: "taskGuide", descKey: "taskGuideDescription", icon: FileText, badgeKey: "advancedBadge", badgeVariant: "secondary" as const },
  { titleKey: "cliReference", descKey: "cliReferenceDescription", icon: Terminal, badgeKey: "referenceBadge", badgeVariant: "outline" as const },
  { titleKey: "apiDocs", descKey: "apiDocsDescription", icon: Code2, badgeKey: "developerBadge", badgeVariant: "outline" as const },
];

export default async function DocsPage() {
  const t = await getTranslations("docs");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("subtitle")}
            </p>
          </div>
          <Button variant="outline" size="sm" className="hover-scale">
            <ExternalLink className="h-4 w-4 mr-2" />
            {t("onlineDocs")}
          </Button>
        </div>

        {/* Doc Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DOC_ITEMS.map((doc, index) => {
            const Icon = doc.icon;
            return (
              <Card
                key={doc.titleKey}
                className={`hover-lift cursor-pointer animate-fade-in stagger-${Math.min(index + 1, 4)} group`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant={doc.badgeVariant}>{t(doc.badgeKey)}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-3">{t(doc.titleKey)}</CardTitle>
                  <CardDescription>{t(doc.descKey)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="w-full justify-center group-hover:bg-primary/10">
                    <BookOpen className="h-4 w-4 mr-2" />
                    {t("readDocs")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Resource Links */}
        <Card className="animate-fade-in stagger-3">
          <CardHeader>
            <CardTitle>{t("relatedResources")}</CardTitle>
            <CardDescription>
              {t("relatedResourcesDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-all cursor-pointer hover-lift">
                <Terminal className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t("rautoGithub")}</p>
                  <p className="text-xs text-muted-foreground">{t("sourceCodeAndIssues")}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-all cursor-pointer hover-lift">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t("changelog")}</p>
                  <p className="text-xs text-muted-foreground">{t("versionHistory")}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
