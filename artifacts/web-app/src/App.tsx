import { useEffect, useRef, type ComponentType } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Home from "@/pages/home";
import IntakeNew from "@/pages/intake-new";
import IntakeSession from "@/pages/intake-session";
import IntakeBrief from "@/pages/intake-brief";
import TherapistsList from "@/pages/therapists-list";
import TherapistDetail from "@/pages/therapist-detail";
import SessionsList from "@/pages/sessions-list";
import OnboardingPage from "@/pages/onboarding";
import PatientPortal from "@/pages/patient-portal";
import TherapistPortal from "@/pages/therapist-portal";
import Results from "@/pages/results";
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
    colorPrimary: "hsl(25, 35%, 45%)",
    colorBackground: "hsl(40, 20%, 98%)",
    colorInputBackground: "hsl(0, 0%, 100%)",
    colorText: "hsl(20, 10%, 15%)",
    colorTextSecondary: "hsl(20, 5%, 45%)",
    colorInputText: "hsl(20, 10%, 15%)",
    colorNeutral: "hsl(40, 15%, 85%)",
    borderRadius: "0.5rem",
    fontFamily: "'Geist', 'Inter', sans-serif",
    fontFamilyButtons: "'Geist', 'Inter', sans-serif",
    fontSize: "14px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-sm border border-border/60 rounded-xl w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: { color: "hsl(20, 10%, 15%)", fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "1.5rem", fontWeight: "500" },
    headerSubtitle: { color: "hsl(20, 5%, 45%)", fontSize: "0.875rem" },
    socialButtonsBlockButtonText: { color: "hsl(20, 10%, 15%)" },
    formFieldLabel: { color: "hsl(20, 10%, 15%)", fontSize: "0.8125rem", fontWeight: "500" },
    footerActionLink: { color: "hsl(25, 35%, 45%)" },
    footerActionText: { color: "hsl(20, 5%, 45%)" },
    dividerText: { color: "hsl(20, 5%, 45%)" },
    identityPreviewEditButton: { color: "hsl(25, 35%, 45%)" },
    formFieldSuccessText: { color: "hsl(150, 40%, 35%)" },
    alertText: { color: "hsl(20, 10%, 15%)" },
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium",
    formFieldInput: "border-border/60 bg-card text-sm rounded-md",
    socialButtonsBlockButton: "border border-border/60 rounded-md",
  },
};

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/portal" />;
  return <Home />;
}

function RequireSignIn({ component: Component, redirectTo = "/sign-up" }: { component: ComponentType; redirectTo?: string }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSignedIn) return <Redirect to={redirectTo} />;
  return <Component />;
}

function RequirePatient({ component: Component }: { component: ComponentType }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  if (!isLoaded || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSignedIn) return <Redirect to="/sign-up" />;
  if (user?.role === "therapist") return <Redirect to="/therapist-portal" />;
  if (user?.role === null) return <Redirect to="/onboarding" />;
  return <Component />;
}

function PortalRedirect() {
  const { data, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.role) return <Redirect to="/onboarding" />;
  if (data.role === "patient") return <Redirect to="/patient-portal" />;
  if (data.role === "therapist") return <Redirect to="/therapist-portal" />;
  return <Redirect to="/" />;
}

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/portal`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/onboarding`} />
      </div>
    </div>
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
      <Route path="/patient-portal" component={PatientPortal} />
      <Route path="/therapist-portal" component={TherapistPortal} />
      <Route path="/intake/new">
        {() => <RequirePatient component={IntakeNew} />}
      </Route>
      <Route path="/intake/:sessionId">
        {() => <RequirePatient component={IntakeSession} />}
      </Route>
      <Route path="/intake/:sessionId/brief">
        {() => <RequireSignIn component={IntakeBrief} redirectTo="/sign-in" />}
      </Route>
      <Route path="/results/:sessionId">
        {() => <RequireSignIn component={Results} redirectTo="/sign-in" />}
      </Route>
      <Route path="/therapists" component={TherapistsList} />
      <Route path="/therapists/:therapistId" component={TherapistDetail} />
      <Route path="/sessions" component={SessionsList} />
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
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your Anamnesis account" } },
        signUp: { start: { title: "Create your account", subtitle: "Join Anamnesis — takes less than a minute" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Layout>
            <Router />
          </Layout>
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
