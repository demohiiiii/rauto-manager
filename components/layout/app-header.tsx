"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Menu, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationPanel } from "@/components/notification-panel";
import { useTranslations } from "next-intl";

type AppHeaderProps = {
  onToggleSidebar?: () => void;
};

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const router = useRouter();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = query.trim();
    const target = trimmedQuery
      ? `/search?q=${encodeURIComponent(trimmedQuery)}`
      : "/search";

    startTransition(() => {
      router.push(target);
    });
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onToggleSidebar}
        aria-label={t("toggleSidebar")}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <form className="flex-1 max-w-xl" onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9 w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isPending}
            aria-label={tc("search")}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationPanel />
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm transition-all duration-300 hover:bg-green-500/20">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-medium">{tc("systemNormal")}</span>
        </div>
      </div>
    </header>
  );
}
