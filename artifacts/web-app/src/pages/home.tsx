import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Activity, LayoutDashboard, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Decorative noise/background elements */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] mix-blend-overlay z-0" 
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}>
      </div>
      
      <div className="max-w-3xl w-full text-center space-y-12 relative z-10">
        <div className="space-y-6">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/10 mb-4" data-testid="icon-logo">
            <ShieldCheck className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground" data-testid="text-title">
            Anamnesis
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed" data-testid="text-subtitle">
            Clinical AI patient intake and provider briefing platform.
            Precise, quiet, and authoritative.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
            <div className="flex flex-col p-8 rounded-xl border bg-card text-card-foreground shadow-sm space-y-6 h-full relative z-10 transition-transform duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-2 text-left">
                <h3 className="text-xl font-semibold">Patient Intake</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Start a secure, interactive session for patient data collection and biometric monitoring.
                </p>
              </div>
              <div className="pt-4 mt-auto">
                <Link href="/intake" className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2" data-testid="link-start-intake">
                  Start Intake
                </Link>
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-accent/0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
            <div className="flex flex-col p-8 rounded-xl border bg-card text-card-foreground shadow-sm space-y-6 h-full relative z-10 transition-transform duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-2">
                <LayoutDashboard className="w-6 h-6 text-foreground" />
              </div>
              <div className="space-y-2 text-left">
                <h3 className="text-xl font-semibold">Provider Dashboard</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Access clinical briefs, review session histories, and analyze patient biometrics.
                </p>
              </div>
              <div className="pt-4 mt-auto">
                <Link href="/dashboard" className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2" data-testid="link-view-dashboard">
                  View Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-0 right-0 text-center text-xs text-muted-foreground/60 tracking-wider uppercase font-medium">
        SECURE CLINICAL ENVIRONMENT
      </div>
    </div>
  );
}
