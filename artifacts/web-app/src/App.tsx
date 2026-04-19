import { useEffect, useRef, type ComponentType } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout, MarketingLayout } from "@/components/layout";
import Home from "@/pages/home";
import IntakeNew from "@/pages/intake-new";
import IntakeSession from "@/pages/intake-session";
import IntakeBrief from "@/pages/intake-brief";
import TherapistsList from "@/pages/therapists-list";
import TherapistDetail from "@/pages/therapist-detail";
import SessionsList from "@/pages/sessions-list";
import OnboardingPage from "@/pages/onboarding";
import DemoPage from "@/pages/demo";
import PatientPortal from "@/pages/patient-portal";
import TherapistPortal from "@/pages/therapist-portal";
import Results from "@/pages/results";
import ScreenerByToken from "@/pages/screener";
import ScreenerExport from "@/pages/screener-export";
import NotFound from "@/pages/not-found";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@clerk/react";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(28, 30%, 50%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInputBackground: "hsl(0, 0%, 100%)",
    colorText: "hsl(25, 18%, 16%)",
    colorTextSecondary: "hsl(25, 8%, 45%)",
    colorInputText: "hsl(25, 18%, 16%)",
    colorNeutral: "hsl(32, 22%, 86%)",
    borderRadius: "0.5rem",
    fontFamily: "'Inter', sans-serif",
    fontFamilyButtons: "'Inter', sans-serif",
    fontSize: "14px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none border-0 w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none p-0",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none p-0",
    headerTitle: { color: "hsl(25, 18%, 16%)", fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "2.25rem", fontWeight: "500", marginTop: "1rem" },
    headerSubtitle: { color: "hsl(25, 8%, 45%)", fontSize: "0.875rem", display: "none" },
    socialButtonsBlockButtonText: { color: "hsl(25, 18%, 16%)", fontWeight: "500" },
    formFieldLabel: { color: "hsl(25, 18%, 16%)", fontSize: "0.8125rem", fontWeight: "500" },
    footerActionLink: { color: "hsl(28, 30%, 50%)", fontWeight: "500" },
    footerActionText: { color: "hsl(25, 8%, 45%)" },
    dividerText: { color: "hsl(25, 8%, 45%)", fontSize: "11px", fontWeight: "600", letterSpacing: "0.05em" },
    identityPreviewEditButton: { color: "hsl(28, 30%, 50%)" },
    formFieldSuccessText: { color: "hsl(150, 40%, 35%)" },
    alertText: { color: "hsl(25, 18%, 16%)" },
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium h-11",
    formFieldInput: "border-border/60 bg-card text-sm rounded-md h-11",
    socialButtonsBlockButton: "border border-border/60 rounded-md h-11 bg-white hover:bg-muted/50",
  },
};

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/portal" />;
  return (
    <MarketingLayout>
      <Home />
    </MarketingLayout>
  );
}

function RequireSignIn({ component: Component, redirectTo = "/sign-up", layout: LayoutComp }: { component: ComponentType; redirectTo?: string, layout?: ComponentType<{children: React.ReactNode}> }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSignedIn) return <Redirect to={redirectTo} />;
  
  if (LayoutComp) {
    return <LayoutComp><Component /></LayoutComp>;
  }
  return <Component />;
}

function RequirePatient({ component: Component, layout: LayoutComp }: { component: ComponentType, layout?: ComponentType<{children: React.ReactNode}> }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  if (!isLoaded || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSignedIn) return <Redirect to="/sign-up" />;
  if (user?.role === "therapist") return <Redirect to="/therapist-portal" />;
  if (user?.role === null) return <Redirect to="/onboarding" />;
  
  if (LayoutComp) {
    return <LayoutComp><Component /></LayoutComp>;
  }
  return <Component />;
}

function PortalRedirect() {
  const { data, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.role) return <Redirect to="/onboarding" />;
  if (data.role === "patient") return <Redirect to="/patient-portal" />;
  if (data.role === "therapist") return <Redirect to="/therapist-portal" />;
  return <Redirect to="/" />;
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-white">
      <div className="w-full md:w-[45%] bg-[#F5EFE6] flex flex-col justify-between p-8 md:p-16 relative overflow-hidden">
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <span className="font-serif italic text-lg text-primary-foreground leading-none -mt-0.5">A</span>
            </div>
            <span className="font-serif text-2xl font-medium tracking-tight text-foreground">Anamnesis</span>
          </div>
          
          <h1 className="font-serif text-4xl md:text-[3.5rem] font-medium leading-[1.1] text-[#2D2626] mb-6">
            Empathetic intake.<br />
            <span className="italic">Clinical precision.</span>
          </h1>
          <p className="text-[#5C544F] text-[15px] leading-relaxed max-w-md">
            Anamnesis brings structured clinical conversation to your intake process, generating comprehensive SOAP notes and biomarker insights before the first session.
          </p>
        </div>
        
        <div className="mt-12 flex flex-wrap gap-3">
          <div className="inline-flex items-center rounded-full border border-[#D5CFC6] bg-transparent px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-[#5C544F]">
            Provider Portal
          </div>
          <div className="inline-flex items-center rounded-full border border-[#D5CFC6] bg-transparent px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-[#5C544F]">
            HIPAA Compliant
          </div>
          <div className="inline-flex items-center rounded-full border border-[#D5CFC6] bg-transparent px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-[#5C544F]">
            SOC2 Type II
          </div>
        </div>
      </div>
      <div className="w-full md:w-[55%] flex items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          {children}
          <div className="mt-8 text-center text-[13px] text-muted-foreground">
            By continuing, you agree to our <a href="#" className="underline underline-offset-2">Terms of Service</a> and <a href="#" className="underline underline-offset-2">Privacy Policy</a>.
          </div>
        </div>
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <AuthLayout>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/portal`}
      />
    </AuthLayout>
  );
}

function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/onboarding`} />
    </AuthLayout>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/portal" component={PortalRedirect} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/demo" component={DemoPage} />
      <Route path="/patient-portal">
        {() => <RequirePatient component={PatientPortal} layout={AppLayout} />}
      </Route>
      <Route path="/therapist-portal">
        {() => <RequireSignIn component={TherapistPortal} redirectTo="/sign-in" layout={AppLayout} />}
      </Route>
      <Route path="/intake/new">
        {() => <RequirePatient component={IntakeNew} layout={AppLayout} />}
      </Route>
      <Route path="/intake/:sessionId">
        {() => <RequirePatient component={IntakeSession} layout={AppLayout} />}
      </Route>
      <Route path="/intake/:sessionId/brief">
        {() => <RequireSignIn component={IntakeBrief} redirectTo="/sign-in" layout={MarketingLayout} />}
      </Route>
      <Route path="/results/:sessionId">
        {() => <RequireSignIn component={Results} redirectTo="/sign-in" layout={MarketingLayout} />}
      </Route>
      <Route path="/therapists">
        {() => (
          <MarketingLayout>
            <TherapistsList />
          </MarketingLayout>
        )}
      </Route>
      <Route path="/therapists/:therapistId">
        {() => (
          <MarketingLayout>
            <TherapistDetail />
          </MarketingLayout>
        )}
      </Route>
      <Route path="/sessions">
        {() => <RequirePatient component={SessionsList} layout={AppLayout} />}
      </Route>
      <Route path="/screener/:token" component={ScreenerByToken} />
      <Route path="/therapist-portal/screener-responses/:responseId/export">
        {() => <RequireSignIn component={ScreenerExport} redirectTo="/sign-in" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={{
        signIn: { start: { title: "Sign in", subtitle: " " } },
        signUp: { start: { title: "Create account", subtitle: " " } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
