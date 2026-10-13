import { useEffect } from "react";
import { RouterProvider, matchRoute, useRoute } from "@/lib/router";
import { AuthProvider } from "@/lib/session";
import { I18nProvider } from "@/lib/i18n-context";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { LandingPage } from "@/pages/landing";
import { ExplorePage } from "@/pages/explore";
import { ProfileDetailPage } from "@/pages/profile-detail";
import ProgramsPage from "@/pages/programs";
import EventsPage from "@/pages/events";
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
import { FeedPage } from "@/pages/feed";
import GroupsPage from "@/pages/groups";
import ChatPage from "@/pages/chat";
import DashboardPage from "@/pages/dashboard";
import AdminPage from "@/pages/admin";
import FinancePage from "@/pages/finance";
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

export default function App() {
  return (
    <I18nProvider>
      <RouterProvider>
        <AuthProvider>
          <AppShell>
            <Routes />
          </AppShell>
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </RouterProvider>
    </I18nProvider>
  );
}
