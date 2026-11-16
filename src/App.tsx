import { lazy, Suspense, useEffect } from "react";
import { RouterProvider, matchRoute, useRoute } from "@/lib/router";
import { AuthProvider, useAuth } from "@/lib/session";
import { VoiceCallProvider } from "@/lib/call-context";
import { VoiceCallOverlay } from "@/components/voice-call-overlay";
import { I18nProvider } from "@/lib/i18n-context";
import { AppShell } from "@/components/app-shell";
import { MobileNav } from "@/components/layout/MobileNav";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { Toaster } from "@/components/ui/sonner";
import NotFoundPage from "@/pages/not-found";

const LandingPage = lazy(() => import("@/pages/landing").then((module) => ({ default: module.LandingPage })));
const ExplorePage = lazy(() => import("@/pages/explore").then((module) => ({ default: module.ExplorePage })));
const ProfileDetailPage = lazy(() => import("@/pages/profile-detail").then((module) => ({ default: module.ProfileDetailPage })));
const ProgramsPage = lazy(() => import("@/pages/programs"));
const EventsPage = lazy(() => import("@/pages/events"));
const EventWizardPage = lazy(() => import("@/pages/event-wizard").then((module) => ({ default: module.EventWizardPage })));
const EventDetailPage = lazy(() => import("@/pages/event-detail"));
const EventManagePage = lazy(() => import("@/pages/event-manage"));
const CampaignsPage = lazy(() => import("@/pages/campaigns").then((module) => ({ default: module.CampaignsPage })));
const CampaignCreatePage = lazy(() => import("@/pages/campaign-create").then((module) => ({ default: module.CampaignCreatePage })));
const BusinessesPage = lazy(() => import("@/pages/businesses"));
const BusinessDetailPage = lazy(() => import("@/pages/business-detail"));
const BusinessFormPage = lazy(() => import("@/pages/business-form"));
const SubscriptionPage = lazy(() => import("@/pages/subscription"));
const AIMentorPage = lazy(() => import("@/pages/ai-mentor"));
const MarketplacePage = lazy(() => import("@/pages/marketplace"));
const MarketplaceDetailPage = lazy(() => import("@/pages/marketplace-detail"));
const MarketplaceFormPage = lazy(() => import("@/pages/marketplace-form"));
const CoinsPage = lazy(() => import("@/pages/coins"));
const LiveTradingPage = lazy(() => import("@/pages/live-trading"));
const AiAgentPage = lazy(() => import("@/pages/ai-agent"));
const LearningCenterPage = lazy(() => import("@/pages/learning-center"));
const EsportPage = lazy(() => import("@/pages/esport"));
const EsportDetailPage = lazy(() => import("@/pages/esport-detail"));
const EsportTeamsPage = lazy(() => import("@/pages/esport-teams"));
const EsportCreatePage = lazy(() => import("@/pages/esport-create"));
const EsportManagePage = lazy(() => import("@/pages/esport-manage"));
const EsportLeaderboardPage = lazy(() => import("@/pages/esport-leaderboard"));
const BursaTransferPage = lazy(() => import("@/pages/bursa-transfer"));
const FeedPage = lazy(() => import("@/pages/feed").then((module) => ({ default: module.FeedPage })));
const GroupsPage = lazy(() => import("@/pages/groups"));
const ChatPage = lazy(() => import("@/pages/chat"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const AdminPage = lazy(() => import("@/pages/admin"));
const FinancePage = lazy(() => import("@/pages/finance"));
const PaymentSuccessPage = lazy(() => import("@/pages/payment-success"));
const PaymentFailedPage = lazy(() => import("@/pages/payment-failed"));
const LoginPage = lazy(() => import("@/pages/login"));
const RegisterPage = lazy(() => import("@/pages/register"));

function Routes() {
  const { path } = useRoute();
  const { name, params } = matchRoute(path);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [path]);

  switch (name) {
    case "landing":
      return <LandingPage />;
    case "explore":
      return <ExplorePage />;
    case "profile":
      return params.id ? <ProfileDetailPage profileId={params.id} /> : <NotFoundPage />;
    case "programs":
      return <ProgramsPage />;
    case "events":
      return params.id ? <EventDetailPage id={params.id} /> : <EventsPage />;
    case "event-new":
      return <EventWizardPage />;
    case "event-manage":
      return params.id ? <EventManagePage id={params.id} /> : <NotFoundPage />;
    case "campaigns":
      return <CampaignsPage />;
    case "campaign-create":
      return <CampaignCreatePage />;
    case "businesses":
      return <BusinessesPage />;
    case "business-detail":
      return params.id ? <BusinessDetailPage id={params.id} /> : <NotFoundPage />;
    case "business-form":
      return <BusinessFormPage />;
    case "subscription":
      return <SubscriptionPage />;
    case "ai-mentor":
      return <AIMentorPage />;
    case "marketplace":
      return <MarketplacePage />;
    case "marketplace-detail":
      return <MarketplaceDetailPage />;
    case "marketplace-form":
      return <MarketplaceFormPage />;
    case "coins":
      return <CoinsPage />;
    case "live-trading":
      return <LiveTradingPage />;
    case "ai-agent":
      return <AiAgentPage />;
    case "learning-center":
      return <LearningCenterPage />;
    case "esport-competition":
      return params.id ? <EsportDetailPage id={params.id} /> : <EsportPage />;
    case "esport-teams":
      return <EsportTeamsPage />;
    case "esport-create":
      return <EsportCreatePage />;
    case "esport-manage":
      return params.id ? <EsportManagePage id={params.id} /> : <NotFoundPage />;
    case "esport-leaderboard":
      return <EsportLeaderboardPage />;
    case "bursa-transfer":
      return <BursaTransferPage />;
    case "payment-success":
      return <PaymentSuccessPage />;
    case "payment-failed":
      return <PaymentFailedPage />;
    case "feed":
      return <FeedPage />;
    case "groups":
      return <GroupsPage />;
    case "chat":
      return <ChatPage />;
    case "dashboard":
      return <DashboardPage />;
    case "admin":
      return <AdminPage />;
    case "finance":
      return <FinancePage />;
    case "login":
      return <LoginPage />;
    case "register":
      return <RegisterPage />;
    default:
      return <NotFoundPage />;
  }
}

function ThemeSync() {
  const { account } = useAuth();

  useEffect(() => {
    const usePublicTheme = !!account && account.accountKind !== "janda";
    document.documentElement.classList.toggle("theme-public", usePublicTheme);
  }, [account]);

  return null;
}

function RouteContent() {
  const { path } = useRoute();
  return (
    <RouteErrorBoundary key={path}>
      <Suspense fallback={(
        <div className="flex min-h-[50vh] items-center justify-center px-4 py-16 text-sm text-muted-foreground" role="status" aria-live="polite">
          Memuat halaman…
        </div>
      )}>
        <Routes />
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <RouterProvider>
        <AuthProvider>
          <VoiceCallProvider>
            <ThemeSync />
            <AppShell>
              <RouteContent />
            </AppShell>
            <VoiceCallOverlay />
            <MobileNav />
            <Toaster position="top-center" richColors closeButton />
          </VoiceCallProvider>
        </AuthProvider>
      </RouterProvider>
    </I18nProvider>
  );
}
