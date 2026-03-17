"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { resetSystem } from "../api";

export function DangerZoneCard() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [resetConfirmation, setResetConfirmation] = useState("");

  const resetMutation = useMutation({
    mutationFn: () => resetSystem(resetConfirmation),
    onSuccess: (data) => {
      toast.success(data.message);
      setResetConfirmation("");
      window.location.reload();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="border-destructive/50 animate-fade-in stagger-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg text-destructive">{t("dangerZone")}</CardTitle>
            <CardDescription>{t("dangerZoneDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("resetSystem")}</p>
            <p className="text-xs text-muted-foreground">
              {t("resetSystemDescription")}
            </p>
          </div>
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setResetConfirmation("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <AlertTriangle className="h-4 w-4 mr-2" />
                {t("resetSystem")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  {t("confirmResetTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("confirmResetDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="reset-confirm" className="text-sm">
                  {t.rich("resetConfirmLabel", {
                    keyword: () => <span className="font-bold text-destructive">RESET</span>,
                  })}
                </Label>
                <Input
                  id="reset-confirm"
                  className="mt-2"
                  placeholder={t("resetConfirmPlaceholder")}
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    resetMutation.mutate();
                  }}
                  disabled={
                    resetConfirmation !== "RESET" || resetMutation.isPending
                  }
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {resetMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t("confirmReset")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
