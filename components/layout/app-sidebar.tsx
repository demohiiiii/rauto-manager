"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileCode,
  FileText,
  LayoutDashboard,
  LogOut,
  Network,
  Server,
  Settings,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const NAV_ITEMS = [
  { nameKey: "dashboard", href: "/", icon: LayoutDashboard, match: "exact" },
  {
    nameKey: "agentManagement",
    href: "/agents",
    icon: Server,
    match: "prefix",
  },
  {
    nameKey: "deviceManagement",
    href: "/devices",
    icon: Network,
    match: "prefix",
  },
  {
    nameKey: "templateManagement",
    href: "/templates",
    icon: FileCode,
    match: "prefix",
  },
  { nameKey: "taskOrchestration", href: "/tasks", icon: Zap, match: "exact" },
  {
    nameKey: "executionHistory",
    href: "/history",
    icon: Activity,
    match: "prefix",
  },
  { nameKey: "docCenter", href: "/docs", icon: FileText, match: "prefix" },
  {
    nameKey: "systemSettings",
    href: "/settings",
    icon: Settings,
    match: "prefix",
  },
] as const;

type AppSidebarProps = {
  isCollapsed: boolean;
  onToggle: () => void;
};

export function AppSidebar({ isCollapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const sidebarHandleClass =
    "flex h-10 w-8 shrink-0 items-center justify-center rounded-[14px] border border-border/70 bg-background/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground dark:border-white/10 dark:bg-slate-950/80";

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? t("logoutFailed"));
      }
      toast.success(t("logoutSuccess"));
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("logoutFailed"));
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex h-full shrink-0 flex-col overflow-visible border-r bg-card/60 backdrop-blur-sm transition-[width] duration-300 ease-in-out",
          isCollapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div
          className={cn(
            "relative flex h-16 items-center border-b bg-card/80 px-3",
            isCollapsed && "justify-center",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center",
              isCollapsed ? "justify-center" : "gap-3",
            )}
          >
            <Link
              href="/"
              className={cn(
                "flex min-w-0 items-center hover:opacity-80 transition-opacity",
                isCollapsed ? "justify-center" : "gap-3",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <Server className="h-5 w-5" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-foreground">
                    {tc("appTitle")}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {tc("appDescription")}
                  </div>
                </div>
              )}
            </Link>
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col p-3 pb-2">
          <div className="flex-1 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.match === "exact"
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              const navItem = (
                <Link
                  key={item.nameKey}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    isCollapsed && "justify-center px-2.5",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform",
                      isActive && "scale-110",
                      isCollapsed && "h-5 w-5",
                    )}
                  />
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{t(item.nameKey)}</span>
                      {isActive && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground/90" />
                      )}
                    </>
                  )}
                </Link>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.nameKey}>
                    <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                    <TooltipContent side="right">
                      {t(item.nameKey)}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return navItem;
            })}
          </div>
        </nav>

        {isCollapsed && (
          <div className="border-t bg-card/70 px-3 py-2">
            <div className="flex justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggle}
                    className={sidebarHandleClass}
                    aria-label={t("expandSidebar")}
                    title={t("expandSidebar")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t("expandSidebar")}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="bg-card/80 p-3 pt-2">
          <div
            className={cn(
              "flex items-center gap-2",
              isCollapsed && "justify-center",
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2.5 text-left transition-colors hover:bg-secondary",
                    isCollapsed ? "justify-center px-2.5" : "min-w-0 flex-1",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-sm">
                    A
                  </div>
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        Admin
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {tc("admin")}
                      </div>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuLabel>{tc("adminAccount")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/settings")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {t("settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!isCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggle}
                    className={sidebarHandleClass}
                    aria-label={t("collapseSidebar")}
                    title={t("collapseSidebar")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {t("collapseSidebar")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
