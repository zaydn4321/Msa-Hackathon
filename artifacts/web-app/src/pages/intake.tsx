import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useCreateSession,
  useEndSession,
  useGetBiometrics,
  getGetBiometricsQueryKey,
} from "@workspace/api-client-react";
import type { IntakeSession } from "@workspace/api-client-react";
import { Activity, Clock, Power, ShieldAlert, HeartPulse, AlertCircle } from "lucide-react";

export default function Intake() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const createSession = useCreateSession();
  const endSession = useEndSession();

  const { data: biometrics } = useGetBiometrics(session?.id ?? 0, {
    query: {
      enabled: !!session?.id,
      queryKey: getGetBiometricsQueryKey(session?.id ?? 0),
      refetchInterval: 5000,
    },
  });

  const latestHR = biometrics?.filter((r) => r.metric === "HR").at(-1);
  const latestHRV = biometrics?.filter((r) => r.metric === "HRV").at(-1);

  useEffect(() => {
    createSession.mutate({ data: {} }, {
      onSuccess: (newSession) => {
        setSession(newSession);
      },
    });
  }, []);

  useEffect(() => {
    if (session) {
      const startTime = new Date(session.startedAt).getTime();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleEndSession = () => {
    if (!session) return;
    endSession.mutate(
      { sessionId: session.id },
      {
        onSuccess: () => {
          setLocation("/dashboard");
        },
      }
    );
  };

  if (createSession.isError) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6" data-testid="error-state">
        <div className="flex flex-col items-center space-y-4 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <h2 className="text-lg font-semibold">Failed to Start Session</h2>
          <p className="text-sm text-muted-foreground">
            Unable to connect to the clinical server. Please check your connection and try again.
          </p>
          <Button onClick={() => setLocation("/")} variant="outline" data-testid="button-go-home">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (createSession.isPending || !session) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center space-y-6">
          <Activity className="w-12 h-12 text-primary animate-pulse" />
          <h2 className="text-xl font-medium text-muted-foreground tracking-wide">INITIALIZING ENVIRONMENT...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03] mix-blend-overlay z-0"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
        }}
      />

      <header className="flex-none p-6 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md relative z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-card border rounded-md shadow-sm">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono tracking-wider font-medium" data-testid="text-session-id">
              ID: {session.id.toString().padStart(5, "0")}
            </span>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-card border rounded-md shadow-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono tracking-wider" data-testid="text-timer">
              {formatTime(elapsed)}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-4 py-1.5 bg-secondary/50 text-secondary-foreground rounded-full border border-secondary-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider" data-testid="status-badge">
              Active Session
            </span>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndSession}
            disabled={endSession.isPending}
            className="font-medium tracking-wide shadow-sm"
            data-testid="button-end-session"
          >
            {endSession.isPending ? (
              "Ending..."
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                END SESSION
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-4xl grid md:grid-cols-[1fr_300px] gap-8 items-center">
          <div className="flex flex-col items-center justify-center space-y-8">
            <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full border border-border/50 bg-card shadow-2xl flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent"></div>
              <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
              <div className="absolute inset-4 border border-muted/30 rounded-full"></div>

              <div className="text-center space-y-4 relative z-10">
                <Activity className="w-12 h-12 text-muted-foreground/50 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                  AI Avatar Active
                </p>
              </div>
            </div>

            <div className="w-full max-w-md h-12 bg-card border rounded-full flex items-center px-6 overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 bg-primary/10 w-1/3 rounded-l-full animate-pulse"></div>
              <span className="text-xs font-mono text-muted-foreground w-full text-center relative z-10 uppercase tracking-widest">
                Listening for audio input...
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
              <div className="flex items-center space-x-3 mb-6">
                <HeartPulse className="w-5 h-5 text-primary" />
                <h3 className="font-semibold tracking-wide uppercase text-sm">Live Biometrics</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Heart Rate</span>
                    <span>BPM</span>
                  </div>
                  <div className="h-16 bg-background rounded-md border flex items-center justify-center" data-testid="biometric-hr">
                    {latestHR ? (
                      <span className="text-2xl font-bold font-mono text-foreground" data-testid="text-hr-value">
                        {latestHR.value.toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-sm font-medium" data-testid="text-hr-status">
                        Awaiting data
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground">
                    <span>HRV</span>
                    <span>MS</span>
                  </div>
                  <div className="h-16 bg-background rounded-md border flex items-center justify-center" data-testid="biometric-hrv">
                    {latestHRV ? (
                      <span className="text-2xl font-bold font-mono text-foreground" data-testid="text-hrv-value">
                        {latestHRV.value.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-sm font-medium" data-testid="text-hrv-status">
                        Awaiting data
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
