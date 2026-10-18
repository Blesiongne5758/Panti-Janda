import { useEffect } from "react";
import { RouterProvider, matchRoute, useRoute } from "@/lib/router";
import { AuthProvider, useAuth } from "@/lib/session";
import { WIDOW_ROLES } from "@/lib/constants";
import { I18nProvider } from "@/lib/i18n-context";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { LandingPage } from "@/pages/landing";
import { ExplorePage } from "@/pages/explore";
import { ProfileDetailPage } from "@/pages/profile-detail";
import ProgramsPage from "@/pages/programs";
import EventsPage from "@/pages/events";
import { EventWizardPage } from "@/pages/event-wizard";
import EventDetailPage from "@/pages/event-detail";
import EventManagePage from "@/pages/event-manage";
import { CampaignsPage } from "@/pages/campaigns";
import { CampaignCreatePage } from "@/pages/campaign-create";
import BusinessesPage from "@/pages/businesses";
import BusinessDetailPage from "@/pages/business-detail";
import BusinessFormPage from "@/pages/business-form";
import SubscriptionPage from "@/pages/subscription";
import AIMentorPage from "@/pages/ai-mentor";
import MarketplacePage from "@/pages/marketplace";
import MarketplaceDetailPage from "@/pages/marketplace-detail";
import MarketplaceFormPage from "@/pages/marketplace-form";
import CoinsPage from "@/pages/coins";
import LiveTradingPage from "@/pages/live-trading";
import AiAgentPage from "@/pages/ai-agent";
import LearningCenterPage from "@/pages/learning-center";
import EsportPage from "@/pages/esport";
import EsportDetailPage from "@/pages/esport-detail";
import EsportTeamsPage from "@/pages/esport-teams";
import EsportCreatePage from "@/pages/esport-create";
import EsportManagePage from "@/pages/esport-manage";
import EsportLeaderboardPage from "@/pages/esport-leaderboard";
import BursaTransferPage from "@/pages/bursa-transfer";
import { FeedPage } from "@/pages/feed";
import GroupsPage from "@/pages/groups";
import ChatPage from "@/pages/chat";
import DashboardPage from "@/pages/dashboard";
import AdminPage from "@/pages/admin";
import FinancePage from "@/pages/finance";
import PaymentSuccessPage from "@/pages/payment-success";
import PaymentFailedPage from "@/pages/payment-failed";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import NotFoundPage from "@/pages/not-found";

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
    const usePublicTheme = !!account && !(WIDOW_ROLES as readonly string[]).includes(account.role);
    document.documentElement.classList.toggle("theme-public", usePublicTheme);
  }, [account]);

  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <RouterProvider>
        <AuthProvider>
          <ThemeSync />
          <AppShell>
            <Routes />
          </AppShell>
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </RouterProvider>
    </I18nProvider>
  );
}
