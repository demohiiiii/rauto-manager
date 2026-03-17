"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, User, Lock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check whether the system still needs initialization and redirect first-time users to /setup
  useEffect(() => {
    async function checkInit() {
      try {
        const res = await fetch("/api/auth/init");
        const data = await res.json();
        if (data.success && data.data.needsInit) {
          router.replace("/setup");
          return;
        }
      } catch {
        // If the check fails, keep showing the login page
      }
      setChecking(false);
    }
    checkInit();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.username || !formData.password) {
      setError(t("usernameAndPasswordRequired"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || t("loginFailed"));
      }
    } catch (error) {
      setError(tc("networkError"));
    } finally {
      setLoading(false);
    }
  };

  // Show a loading state while the initialization check is running
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 animate-scale-in">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Rauto Manager</h1>
          <p className="text-muted-foreground">
            {t("platformName")}
          </p>
        </div>

        {/* Login Form */}
        <Card className="border-2 hover-lift">
          <CardHeader>
            <CardTitle>{t("adminLogin")}</CardTitle>
            <CardDescription>
              {t("adminLoginDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  {t("username")}
                </label>
                <Input
                  type="text"
                  placeholder={t("usernamePlaceholder")}
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  disabled={loading}
                  autoFocus
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  {t("password")}
                </label>
                <Input
                  type="password"
                  placeholder={t("passwordPlaceholder")}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  disabled={loading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("loggingIn")}
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    {t("loginButton")}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          {t("footer")}
        </p>
      </div>
    </div>
  );
}
