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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { User, Lock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { changePassword } from "../api";
import type { SettingsData } from "../api";

export function UserProfileCard({
  admin,
}: {
  admin: SettingsData["admin"];
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success(t("passwordChangeSuccess"));
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmitPassword = () => {
    if (!currentPassword || !newPassword) {
      toast.error(t("passwordIncomplete"));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t("passwordMinLength"));
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error(t("passwordRequiresLetterAndNumber"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }
    if (newPassword === currentPassword) {
      toast.error(t("passwordSameAsOld"));
      return;
    }
    passwordMutation.mutate();
  };

  return (
    <Card className="animate-fade-in stagger-1">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">{t("userProfile")}</CardTitle>
            <CardDescription>{t("userProfileDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("usernameLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("usernameDescription")}</p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {admin?.username ?? "—"}
          </Badge>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("emailLabel")}</p>
            <p className="text-xs text-muted-foreground">{t("emailDescription")}</p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {admin?.email ?? tc("notSet")}
          </Badge>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("registeredAt")}</p>
            <p className="text-xs text-muted-foreground">{t("registeredAtDescription")}</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {admin?.createdAt
              ? new Date(admin.createdAt).toLocaleDateString()
              : "—"}
          </Badge>
        </div>
        <Separator />
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("changePassword")}</p>
            <p className="text-xs text-muted-foreground">
              {t("changePasswordDescription")}
            </p>
          </div>
          <AlertDialog
            open={showPasswordDialog}
            onOpenChange={(open) => {
              setShowPasswordDialog(open);
              if (!open) {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Lock className="h-4 w-4 mr-2" />
                {t("changePassword")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("changePasswordTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("changePasswordHint")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">{t("currentPassword")}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    placeholder={t("currentPasswordPlaceholder")}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t("newPassword")}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder={t("newPasswordPlaceholder")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t("confirmNewPassword")}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder={t("confirmNewPasswordPlaceholder")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleSubmitPassword();
                  }}
                  disabled={passwordMutation.isPending}
                >
                  {passwordMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t("confirmChange")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
