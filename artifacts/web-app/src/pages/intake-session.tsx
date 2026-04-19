import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useGetBiometrics, useAddBiometrics, useEndSession, getGetBiometricsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Activity, HeartPulse, VideoOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function IntakeSession() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const sessionId = Number(params.sessionId);
  const queryClient = useQueryClient();

  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [tavusError, setTavusError] = useState<boolean>(false);
  const [isLoadingTavus, setIsLoadingTavus] = useState(true);

  const { data: biometrics } = useGetBiometrics(sessionId, {
    query: { queryKey: getGetBiometricsQueryKey(sessionId), refetchInterval: 5000 },
  });

  const endSession = useEndSession();
  const addBiometrics = useAddBiometrics();
  const isEndingRef = useRef(false);

  useEffect(() => {
    async function initTavus() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/tavus`, { method: "POST" });
        if (!res.ok) {
          throw new Error("Failed to initialize video");
        }
        const data = await res.json();
        if (data.conversationUrl) {
          setConversationUrl(data.conversationUrl);
        } else {
          setTavusError(true);
        }
      } catch (err) {
        console.error(err);
        setTavusError(true);
      } finally {
        setIsLoadingTavus(false);
      }
    }
    initTavus();
  }, [sessionId]);

  // Simulate biometrics
  useEffect(() => {
    const interval = setInterval(() => {
      const hr = Math.floor(Math.random() * (100 - 60 + 1) + 60);
      const hrv = Math.floor(Math.random() * (80 - 20 + 1) + 20);
      
      addBiometrics.mutate({
        sessionId,
        data: {
          readings: [
            { metric: "HR", value: hr, recordedAt: new Date().toISOString() },
            { metric: "HRV", value: hrv, recordedAt: new Date().toISOString() }
          ]
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBiometricsQueryKey(sessionId) });
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, addBiometrics, queryClient]);

  const handleEndSession = () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    
    endSession.mutate({ sessionId }, {
      onSuccess: () => {
        setLocation(`/results/${sessionId}`);
      },
      onError: (err) => {
        isEndingRef.current = false;
        toast({
          title: "Error",
          description: "Could not end the session correctly. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  const latestHr = biometrics?.filter(b => b.metric === "HR").pop()?.value || "--";
  const latestHrv = biometrics?.filter(b => b.metric === "HRV").pop()?.value || "--";

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-medium text-foreground">Intake Session</h1>
            <p className="text-muted-foreground text-sm">Please answer the questions as naturally as possible.</p>
          </div>
          <Button 
            variant="destructive" 
            onClick={handleEndSession}
            disabled={endSession.isPending || isEndingRef.current}
            className="rounded-md"
          >
            {endSession.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            End Session
          </Button>
        </div>

        <div className="relative flex-1 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden min-h-[400px] flex items-center justify-center">
          {isLoadingTavus ? (
            <div className="flex flex-col items-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p>Connecting to secure video...</p>
            </div>
          ) : tavusError || !conversationUrl ? (
            <div className="flex flex-col items-center text-muted-foreground max-w-md text-center p-6">
              <VideoOff className="h-12 w-12 mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-2">AI intake interview</h3>
              <p>Connect Tavus API to enable live video. You can continue without video if necessary.</p>
            </div>
          ) : (
            <iframe 
              src={conversationUrl} 
              allow="microphone; camera" 
              className="w-full h-full border-none"
              title="Tavus Interview"
            />
          )}
        </div>
      </div>

      <div className="w-full md:w-80 flex flex-col gap-4">
        <h2 className="font-serif text-xl font-medium text-foreground">Live Vitals</h2>
        <p className="text-sm text-muted-foreground mb-2">
          We gently monitor physiological cues to gain a deeper understanding of your stress levels.
        </p>

        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Heart Rate</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-medium text-foreground">{latestHr}</span>
                <span className="text-sm text-muted-foreground">bpm</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">HRV</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-medium text-foreground">{latestHrv}</span>
                <span className="text-sm text-muted-foreground">ms</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border/50 text-sm text-secondary-foreground space-y-2">
          <p><strong>Note:</strong> These readings are simulated for demonstration purposes.</p>
        </div>
      </div>
    </div>
  );
}
