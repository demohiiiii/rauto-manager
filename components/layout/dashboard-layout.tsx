"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";

const SIDEBAR_STORAGE_KEY = "rauto-manager-sidebar-collapsed";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedState = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (savedState === "true") {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader onToggleSidebar={handleToggleSidebar} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-muted/40 p-4 md:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
