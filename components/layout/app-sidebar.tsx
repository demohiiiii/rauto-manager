"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Server,
  Network,
  Zap,
  Workflow,
  Settings,
  FileText,
  Activity,
  LogOut,
  ChevronsUpDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const NAV_ITEMS = [
  { nameKey: "dashboard", href: "/", icon: LayoutDashboard, match: "exact" },
  { nameKey: "agentManagement", href: "/agents", icon: Server, match: "prefix" },
  { nameKey: "deviceManagement", href: "/devices", icon: Network, match: "prefix" },
  { nameKey: "taskOrchestration", href: "/tasks", icon: Zap, match: "exact" },
  { nameKey: "complexTaskDesigner", href: "/tasks/designer", icon: Workflow, match: "prefix" },
  { nameKey: "executionHistory", href: "/history", icon: Activity, match: "prefix" },
  { nameKey: "docCenter", href: "/docs", icon: FileText, match: "prefix" },
  { nameKey: "systemSettings", href: "/settings", icon: Settings, match: "prefix" },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const tc = useTranslations("common");

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
    <div className="flex h-full w-64 flex-col border-r bg-card/50 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6 bg-card/80">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
            <Server className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Rauto Manager</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.match === "exact"
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.nameKey}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:shadow-sm"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-transform",
                isActive && "scale-110"
              )} />
              {t(item.nameKey)}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer - Admin user with logout */}
      <div className="border-t p-4 bg-card/80">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2.5 hover:bg-secondary transition-colors cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md">
                A
              </div>
              <div className="flex-1 text-left text-sm">
                <div className="font-medium">Admin</div>
                <div className="text-xs text-muted-foreground">{tc("admin")}</div>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
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
      </div>
    </div>
  );
}
