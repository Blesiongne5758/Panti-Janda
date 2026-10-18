import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, FileUp, Flower2, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRoute } from "@/lib/router";
import { useAuth } from "@/lib/session";
import { errorText } from "@/lib/api";
import { TIER_META } from "@/lib/constants";
import { DOC_TYPE_OPTIONS, docErrorText, docKb, prepareVerificationDoc } from "@/lib/verify-doc";
import { PjLogo } from "@/components/common";
import { useTranslation } from "@/lib/i18n-context";
import type { VerificationDocType } from "@/lib/types";
import { PasswordStrengthMeter, StrongPasswordGenerator } from "@/components/password-generator";

const toList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

type Step = "account" | "question" | "form";
type Kind = "member" | "public";

export default function RegisterPage() {
  const { register } = useAuth();
  const { navigate } = useRoute();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("account");
  const [kind, setKind] = useState<Kind | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const [nickname, setNickname] = useState("");
  const [fullName, setFullName] = useState("");
  const [docType, setDocType] = useState<VerificationDocType>("ktp");
  const [doc, setDoc] = useState<{ fileName: string; dataUrl: string } | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [age, setAge] = useState("");
  const [dependents, setDependents] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [skills, setSkills] = useState("");
  const [trainings, setTrainings] = useState("");
  const [needsTarget, setNeedsTarget] = useState("");
  const [mainTarget, setMainTarget] = useState("");
  const [interests, setInterests] = useState("");
  const [bio, setBio] = useState("");
  const [fundingInfo, setFundingInfo] = useState("");

  async function onDocChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setDocError(null);
    setDocBusy(true);
    try {
      setDoc(await prepareVerificationDoc(file));
    } catch (err) {
      setDoc(null);
      setDocError(docErrorText(err));
    } finally {
      setDocBusy(false);
    }
  }

  function handleAccountSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setStep("question");
  }

  function handleQuestionAnswer(answer: Kind) {
    setError(null);
    setKind(answer);
    setStep("form");
  }

  function goBack() {
    setError(null);
    setNotice(null);
    if (step === "form") {
      setKind(null);
      setStep("question");
    } else if (step === "question") {
      setStep("account");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!kind) return;
    if (kind === "member" && !doc) {
      setError(t("auth.docRequired"));
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> =
        kind === "member"
          ? {
              kind,
              email: email.trim(),
              password,
              nickname: nickname.trim(),
              fullName: fullName.trim(),
              verificationDoc: doc
                ? { type: docType, fileName: doc.fileName, dataUrl: doc.dataUrl }
                : undefined,
              city: city.trim() || undefined,
              age: age ? Number(age) : undefined,
              dependents: dependents ? Number(dependents) : undefined,
              employmentStatus: employmentStatus.trim() || undefined,
              skills: toList(skills),
              trainings: toList(trainings),
              needsTarget: needsTarget.trim() || undefined,
              mainTarget: mainTarget.trim() || undefined,
              interests: toList(interests),
              bio: bio.trim() || undefined,
              fundingInfo: fundingInfo.trim() || undefined,
            }
          : { kind, email: email.trim(), password, displayName: displayName.trim() };
      const result = await register(payload);
      if (result.bootstrap) {
        setNotice(t("auth.adminNoticeFull"));
        navigate("/admin");
        return;
      }
      navigate("/dasbor");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-14">
      <PjLogo size={72} className="text-primary" />
      <div className="w-full text-center">
        <h1 className="font-display text-3xl font-semibold">{t("auth.registerTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.registerDesc")}
        </p>
      </div>

      {step === "account" && (
        <Card className="border-border/70">
          <CardHeader className="gap-1.5">
            <CardTitle className="font-display text-xl">{t("auth.stepAccount")}</CardTitle>
            <CardDescription>{t("auth.stepAccountDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleAccountSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">{t("auth.email")} *</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t("auth.passwordMin")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pr-10"
                    placeholder="Minimal 8 karakter"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>

                {/* Indikator Kekuatan Password Real-time */}
                <PasswordStrengthMeter password={password} />

                {/* Pengaturan Pembuat Password Kuat */}
                <div className="pt-1">
                  <StrongPasswordGenerator onApply={(pw) => setPassword(pw)} />
                </div>
              </div>
              {error ? (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>
              ) : null}
              <Button type="submit" className="w-full">
                <ArrowRight className="size-4" />
                {t("common.next")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "question" && (
        <Card className="border-border/70">
          <CardHeader className="gap-1.5">
            <CardTitle className="font-display text-xl">{t("auth.stepQuestion")}</CardTitle>
            <CardDescription>
              {t("auth.stepQuestionDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm font-medium">{t("auth.widowQuestion")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto flex-col items-start gap-2 py-4 text-left"
                onClick={() => handleQuestionAnswer("member")}
              >
                <Flower2 className="size-5 text-primary" />
                <div>
                  <p className="font-semibold">{t("auth.yesWidow")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("auth.yesWidowDesc")}
                  </p>
                </div>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto flex-col items-start gap-2 py-4 text-left"
                onClick={() => handleQuestionAnswer("public")}
              >
                <UserPlus className="size-5 text-primary" />
                <div>
                  <p className="font-semibold">{t("auth.noWidow")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("auth.noWidowDesc")}
                  </p>
                </div>
              </Button>
            </div>
            {error ? (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="button" variant="ghost" onClick={goBack} className="w-fit">
              <ArrowLeft className="size-4" />
              {t("common.back")}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "form" && kind === "member" && (
        <Card className="border-border/70">
          <CardHeader className="gap-1.5">
            <CardTitle className="font-display text-xl">
              {t("auth.stepMember")} — tier {TIER_META.wonder_woman.label}
            </CardTitle>
            <CardDescription>
              {t("auth.stepMemberDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="m-fullname">{t("auth.fullName")}</Label>
                <Input
                  id="m-fullname"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder={t("auth.fullNamePlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("auth.fullNameNote")}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="m-nickname">{t("auth.nickname")}</Label>
                <Input
                  id="m-nickname"
                  required
                  minLength={2}
                  maxLength={40}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder={t("auth.nicknamePlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-city">{t("auth.city")}</Label>
                <Input id="m-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Bandung" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="m-age">{t("auth.age")}</Label>
                  <Input
                    id="m-age"
                    type="number"
                    min={17}
                    max={99}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="m-dependents">{t("auth.dependents")}</Label>
                  <Input
                    id="m-dependents"
                    type="number"
                    min={0}
                    max={20}
                    value={dependents}
                    onChange={(event) => setDependents(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-job">{t("auth.employmentStatus")}</Label>
                <Input
                  id="m-job"
                  value={employmentStatus}
                  onChange={(event) => setEmploymentStatus(event.target.value)}
                  placeholder={t("auth.employmentPlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-skills">{t("auth.skills")}</Label>
                <Input
                  id="m-skills"
                  value={skills}
                  onChange={(event) => setSkills(event.target.value)}
                  placeholder={t("auth.skillsPlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-trainings">{t("auth.trainings")}</Label>
                <Input
                  id="m-trainings"
                  value={trainings}
                  onChange={(event) => setTrainings(event.target.value)}
                  placeholder={t("auth.trainingsPlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-interests">{t("auth.interests")}</Label>
                <Input
                  id="m-interests"
                  value={interests}
                  onChange={(event) => setInterests(event.target.value)}
                  placeholder={t("auth.interestsPlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-needs">{t("auth.needsTarget")}</Label>
                <Input
                  id="m-needs"
                  value={needsTarget}
                  onChange={(event) => setNeedsTarget(event.target.value)}
                  placeholder={t("auth.needsPlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-main">{t("auth.mainTarget")}</Label>
                <Input
                  id="m-main"
                  value={mainTarget}
                  onChange={(event) => setMainTarget(event.target.value)}
                  placeholder={t("auth.mainTargetPlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="m-funding">{t("auth.fundingInfo")}</Label>
                <Input
                  id="m-funding"
                  value={fundingInfo}
                  onChange={(event) => setFundingInfo(event.target.value)}
                  placeholder={t("auth.fundingPlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="m-bio">{t("auth.bio")}</Label>
                <Textarea
                  id="m-bio"
                  rows={3}
                  maxLength={1200}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder={t("auth.bioPlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/40 p-4 sm:col-span-2">
                <div>
                  <Label>{t("auth.verificationDoc")}</Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("auth.verificationDocDesc")}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="sm:w-64">
                    <Select value={docType} onValueChange={(value) => setDocType(value as VerificationDocType)}>
                      <SelectTrigger aria-label={t("auth.docTypeLabel")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent">
                    {docBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <FileUp className="size-4" aria-hidden />
                    )}
                    {doc ? t("auth.changeImage") : t("auth.chooseImage")}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={docBusy}
                      onChange={onDocChange}
                    />
                  </label>
                </div>
                {doc ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2">
                    <img
                      src={doc.dataUrl}
                      alt={t("auth.docPreview")}
                      className="size-14 rounded-lg border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {docKb(doc.dataUrl)} KB · {t("auth.readyToUpload")}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDoc(null)} disabled={docBusy}>
                      {t("common.delete")}
                    </Button>
                  </div>
                ) : null}
                {docError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {docError}
                  </p>
                ) : null}
              </div>
              {error ? (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary sm:col-span-2">{notice}</p>
              ) : null}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={goBack} disabled={busy}>
                  <ArrowLeft className="size-4" />
                  {t("common.back")}
                </Button>
                <Button type="submit" disabled={busy} className="flex-1">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {t("auth.submitVerify")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "form" && kind === "public" && (
        <Card className="border-border/70">
          <CardHeader className="gap-1.5">
            <CardTitle className="font-display text-xl">{t("auth.stepPublic")}</CardTitle>
            <CardDescription>
              {t("auth.stepPublicDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={submit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-name">{t("auth.displayName")}</Label>
                <Input
                  id="p-name"
                  required
                  minLength={2}
                  maxLength={60}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={t("auth.displayNamePlaceholder")}
                />
              </div>
              {error ? (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>
              ) : null}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={goBack} disabled={busy}>
                  <ArrowLeft className="size-4" />
                  {t("common.back")}
                </Button>
                <Button type="submit" disabled={busy} className="flex-1">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  {t("auth.submitPublic")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.hasAccount")}{" "}
        <Link to="/masuk" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("auth.loginLink")}
        </Link>
      </p>
    </div>
  );
}
