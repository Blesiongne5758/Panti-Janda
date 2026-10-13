import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRoute } from "@/lib/router";
import { useAuth } from "@/lib/session";
import { errorText } from "@/lib/api";
import { PjLogo } from "@/components/common";
import { useTranslation } from "@/lib/i18n-context";

export default function LoginPage() {
  const { login } = useAuth();
  const { navigate } = useRoute();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const account = await login(email.trim(), password);
      navigate(account.role === "admin" ? "/admin" : "/dasbor");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-4 py-14">
      <PjLogo size={72} className="text-primary" />
      <Card className="w-full border-border/70 shadow-sm">
        <CardHeader className="gap-1.5">
          <CardTitle className="font-display text-2xl">{t("auth.loginTitle")}</CardTitle>
          <CardDescription>
            {t("auth.loginDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("auth.emailPlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
              />
            </div>
            {error ? (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              {t("auth.login")}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link to="/daftar" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("auth.registerLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        {t("auth.loginNote")}
      </p>
    </div>
  );
}
