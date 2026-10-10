import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRoute } from "@/lib/router";
import { useAuth } from "@/lib/session";
import { errorText } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const { navigate } = useRoute();
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
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-14">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="gap-1.5">
          <CardTitle className="font-display text-2xl">Masuk ke Panti Janda</CardTitle>
          <CardDescription>
            Sesi berlaku 30 hari di perangkat ini. Gunakan email dan kata sandi yang kamu daftarkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@email.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Kata sandi</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimal 8 karakter"
              />
            </div>
            {error ? (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Masuk
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link to="/daftar" className="font-medium text-primary underline-offset-4 hover:underline">
              Daftar sebagai non janda atau anggota janda
            </Link>
          </p>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Anggota janda mendaftar dengan data profil lengkap, lalu menunggu verifikasi admin sebelum tampil di
        halaman jelajah.
      </p>
    </div>
  );
}
