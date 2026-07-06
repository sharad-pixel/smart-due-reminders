import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Loader2, Building2, ShieldCheck } from "lucide-react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SecurityAlert } from "@/components/security/SecurityAlert";
import { SupportAccessBanner } from "@/components/security/SupportAccessBanner";
import { SupportImpersonationBanner } from "@/components/security/SupportImpersonationBanner";
import { isImpersonating } from "@/lib/supportImpersonation";
import { logAuditEvent } from "@/lib/auditLog";
import { RecouplyLogo } from "@/components/layout/RecouplyLogo";
import NicolasChat from "@/components/nicolas/NicolasChat";
import { SmartIngestionChooserDialog } from "@/components/ingestion/SmartIngestionChooserDialog";
import { NicolasPageTip } from "@/components/nicolas/NicolasPageTip";
import { OnboardingWelcome } from "@/components/layout/OnboardingWelcome";
import { useEffectiveAccount } from "@/hooks/useEffectiveAccount";
import { useSubscription } from "@/hooks/useSubscription";
import { useOnboardingCompletion } from "@/hooks/useOnboardingCompletion";
import { useClmEntitlement } from "@/hooks/useClmEntitlement";
import { FloatingReferralAgent } from "@/components/referral/FloatingReferralAgent";
import { useUserAlerts } from "@/hooks/useUserAlerts";
import { RequireSubscription } from "@/components/billing/RequireSubscription";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { AccountLockoutBanner } from "@/components/accounts/AccountLockoutBanner";
import { AppSidebar } from "@/components/layout/AppSidebar";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [trialBannerVisible, setTrialBannerVisible] = useState(false);
  const [smartIngestionOpen, setSmartIngestionOpen] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const { unreadCount: alertUnreadCount } = useUserAlerts();
  useClmEntitlement();
  const {
    isTeamMember,
    ownerName,
    ownerEmail,
    ownerCompanyName,
    ownerPlanType,
    ownerSubscriptionStatus,
    memberRole,
    organizationName,
    loading: accountLoading,
  } = useEffectiveAccount();
  const {
    plan: effectivePlan,
    subscriptionStatus: effectiveSubscriptionStatus,
    isLoading: subscriptionLoading,
  } = useSubscription();
  const {
    percentage: onboardingPct,
    showRing,
    loading: onboardingLoading,
  } = useOnboardingCompletion();

  const displayPlanType = isTeamMember
    ? (ownerPlanType || effectivePlan || "free")
    : (effectivePlan || "free");
  const displaySubscriptionStatus = isTeamMember
    ? (ownerSubscriptionStatus || effectiveSubscriptionStatus || "inactive")
    : (effectiveSubscriptionStatus || "inactive");
  const canUpgrade = !isTeamMember;

  const FOUNDER_EMAIL = "sharad@recouply.ai";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user && authChecked) {
        const publicPaths = ["/login", "/signup", "/auth", "/legal", "/pricing", "/features", "/about", "/integrations", "/contact", "/coming-soon"];
        const isPublic = publicPaths.some((p) => location.pathname === p || location.pathname.startsWith(p));
        if (!isPublic) {
          navigate("/login", { replace: true, state: { from: location.pathname + location.search } });
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
      if (!session?.user) {
        const publicPaths = ["/login", "/signup", "/auth", "/legal", "/pricing", "/features", "/about", "/integrations", "/contact", "/coming-soon"];
        const isPublic = publicPaths.some((p) => location.pathname === p || location.pathname.startsWith(p));
        if (!isPublic) {
          navigate("/login", { replace: true, state: { from: location.pathname + location.search } });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname, location.search, authChecked]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email, avatar_url, is_admin")
          .eq("id", user.id)
          .single();

        if (profile?.name) setUserName(profile.name);
        else if (profile?.email) setUserName(profile.email.split("@")[0]);
        else if (user.email) setUserName(user.email.split("@")[0]);

        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);

        if (user.email?.toLowerCase() === FOUNDER_EMAIL.toLowerCase() && profile?.is_admin) {
          setIsFounder(true);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        if (user.email) setUserName(user.email.split("@")[0]);
      }
    };

    const checkTeamAccess = async () => {
      if (!user) return;
      try {
        const { data: membershipData } = await supabase
          .from("account_users")
          .select("role, status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();
        if (!membershipData || membershipData.role === "owner" || membershipData.role === "admin") {
          setShowTeam(true);
        }
      } catch (error) {
        console.error("Error checking team access:", error);
        setShowTeam(true);
      }
    };

    fetchUserProfile();
    checkTeamAccess();
  }, [user]);

  const handleSignOut = async () => {
    if (user) {
      await logAuditEvent({
        action: "logout",
        resourceType: "profile",
        resourceId: user.id,
        metadata: { timestamp: new Date().toISOString() },
      });
    }
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const getLockoutReason = (): "past_due" | "expired" | "canceled" | "locked" | null => {
    if (accountLoading || subscriptionLoading) return null;
    const status = displaySubscriptionStatus;
    if (status === "past_due") return "past_due";
    if (status === "canceled") return "canceled";
    if (status === "expired") return "expired";
    if (status === "inactive" && displayPlanType !== "free") return "expired";
    return null;
  };

  const lockoutReason = getLockoutReason();
  const showLockoutBanner = lockoutReason !== null;
  const showViewingBanner =
    (isTeamMember || isImpersonating()) &&
    !accountLoading &&
    (ownerName || ownerEmail || ownerCompanyName);

  return (
    <RequireSubscription>
      <TrialBanner onVisibilityChange={setTrialBannerVisible} />
      <SidebarProvider>
        <div className={`flex min-h-screen w-full bg-background ${trialBannerVisible ? "pt-[40px]" : ""}`}>
          <AppSidebar
            userName={userName}
            avatarUrl={avatarUrl}
            showRing={showRing && !onboardingLoading}
            onboardingPct={onboardingPct}
            alertUnreadCount={alertUnreadCount}
            showTeam={showTeam}
            isFounder={isFounder}
            displayPlanType={displayPlanType}
            displaySubscriptionStatus={displaySubscriptionStatus}
            isTeamMember={isTeamMember}
            memberRole={memberRole}
            ownerCompanyName={ownerCompanyName}
            ownerName={ownerName}
            ownerEmail={ownerEmail}
            canUpgrade={canUpgrade}
            onOpenSmartIngestion={() => setSmartIngestionOpen(true)}
            onSignOut={handleSignOut}
          />

          <SidebarInset className="flex flex-col min-w-0">
            <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b bg-card/80 backdrop-blur px-4">
              <SidebarTrigger />
              <div className="flex-1" />
            </header>

            <SupportImpersonationBanner />
            <SupportAccessBanner />
            <SecurityAlert />

            {showLockoutBanner && (
              <div className="px-4 sm:px-6 pt-4">
                <AccountLockoutBanner
                  lockoutReason={lockoutReason}
                  isTeamMember={isTeamMember}
                  ownerEmail={ownerEmail}
                  ownerName={ownerName}
                />
              </div>
            )}

            {showViewingBanner && (
              <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
                <div className="flex flex-col items-center justify-center gap-1 text-sm sm:flex-row sm:flex-wrap sm:gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">
                      Viewing account of{" "}
                      <span className="font-medium text-foreground">
                        {ownerName || ownerCompanyName || ownerEmail}
                      </span>
                      {ownerEmail && (ownerName || ownerCompanyName) && (
                        <span className="text-muted-foreground"> ({ownerEmail})</span>
                      )}
                    </span>
                  </div>
                  {organizationName && (
                    <span className="text-xs text-muted-foreground">
                      Org: <span className="font-medium text-foreground">{organizationName}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            <main className="flex-1 w-full min-w-0 px-4 sm:px-6 lg:px-10 py-4 sm:py-6">
              {children}
            </main>

            <footer className="border-t bg-card/50 py-4 px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <RecouplyLogo size="sm" />
                  <span className="text-muted-foreground text-xs">Revenue Intelligence Platform</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <Link to="/knowledge-base" className="hover:text-foreground">Knowledge Base</Link>
                  <Link to="/legal/privacy" className="hover:text-foreground">Privacy</Link>
                  <Link to="/legal/terms" className="hover:text-foreground">Terms</Link>
                  <Link to="/contact-us" className="hover:text-foreground">Support</Link>
                  <Link
                    to="/security#responsible-ai"
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20"
                  >
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    <span className="font-medium text-primary">Responsible AI</span>
                  </Link>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  © {new Date().getFullYear()} Recouply.ai
                </div>
              </div>
            </footer>
          </SidebarInset>
        </div>
      </SidebarProvider>

      <OnboardingWelcome />
      <NicolasPageTip />
      <NicolasChat />
      <SmartIngestionChooserDialog open={smartIngestionOpen} onOpenChange={setSmartIngestionOpen} />
      <FloatingReferralAgent />
    </RequireSubscription>
  );
};

export default Layout;
