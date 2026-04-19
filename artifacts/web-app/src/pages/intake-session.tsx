import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useGetBiometrics, useAddBiometrics, useEndSession, getGetBiometricsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, Video, PhoneOff, Settings, Activity, HeartPulse, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function IntakeSession() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const sessionId = Number(params.sessionId);
  const queryClient = useQueryClient();

  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [tavusError, setTavusError] = useState<string | null>(null);
  const [isLoadingTavus, setIsLoadingTavus] = useState(true);
  const [sessionTime, setSessionTime] = useState(0);

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
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setTavusError(data?.error ?? `Server returned ${res.status}.`);
        } else if (data.conversationUrl) {
          setConversationUrl(data.conversationUrl);
        } else {
          setTavusError(data?.error ?? "Tavus did not return a conversation URL.");
        }
      } catch (err) {
        setTavusError(err instanceof Error ? err.message : "Network error contacting the server.");
      } finally {
        setIsLoadingTavus(false);
      }
    }
    initTavus();
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => setSessionTime(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const hr = Math.floor(Math.random() * (100 - 60 + 1) + 60);
      const hrv = Math.floor(Math.random() * (80 - 20 + 1) + 20);
      addBiometrics.mutate({
        sessionId,
        data: { readings: [{ metric: "HR", value: hr, recordedAt: new Date().toISOString() }, { metric: "HRV", value: hrv, recordedAt: new Date().toISOString() }] }
      }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBiometricsQueryKey(sessionId) })
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, addBiometrics, queryClient]);

  const handleEndSession = () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    endSession.mutate({ sessionId }, {
      onSuccess: () => setLocation(`/intake/${sessionId}/brief`),
      onError: () => { isEndingRef.current = false; setLocation(`/intake/${sessionId}/brief`); } // Fallback redirect anyway
    });
  };

  const latestHr = biometrics?.filter(b => b.metric === "HR").pop()?.value || "--";
  const latestHrv = biometrics?.filter(b => b.metric === "HRV").pop()?.value || "--";

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] bg-[#F8F9FA] overflow-hidden p-6 gap-6 max-w-[1600px] mx-auto w-full">
      {/* Top Session Bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E8E1D7] px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium text-[#2D2626]">Active Intake Session</span>
          </div>
          <div className="h-4 w-[1px] bg-[#E8E1D7]" />
          <span className="font-mono text-[15px] font-medium text-[#5C544F]">{formatTime(sessionTime)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-xs font-medium border border-red-100 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Safety & Grounding
          </div>
          <Button variant="outline" className="h-9 rounded-full border-[#E8E1D7] text-[#5C544F] hover:bg-black/5" onClick={handleEndSession}>
            Save & Exit
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-6">
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-[#E8E1D7] shadow-sm overflow-hidden relative">
          <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
            <div className="bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 border border-white/10">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Conversational Companion Active
            </div>
            <div className="bg-black/40 backdrop-blur-md text-white px-3 py-2 rounded-full flex items-center gap-1 border border-white/10">
              <div className="h-2 w-1 bg-white/60 animate-[pulse_1s_ease-in-out_infinite]" />
              <div className="h-3 w-1 bg-white/80 animate-[pulse_1s_ease-in-out_infinite_0.2s]" />
              <div className="h-4 w-1 bg-white animate-[pulse_1s_ease-in-out_infinite_0.4s]" />
              <div className="h-2 w-1 bg-white/60 animate-[pulse_1s_ease-in-out_infinite_0.1s]" />
            </div>
          </div>

          <div className="flex-1 relative bg-[#E8E1D7]">
            {isLoadingTavus ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#5C544F]">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-[#9B7250]" />
                <p>Connecting to secure video...</p>
              </div>
            ) : tavusError || !conversationUrl ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 bg-gradient-to-br from-[#2D2626] to-[#3a3030] text-[#F5EFE6]">
                <div className="h-14 w-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center mb-5">
                  <AlertCircle className="h-7 w-7 text-[#E8B7A0]" />
                </div>
                <p className="font-serif text-2xl mb-3">Video companion unavailable</p>
                <p className="text-sm text-[#F5EFE6]/70 max-w-md leading-relaxed mb-6">
                  {tavusError ?? "The Tavus session could not be started."}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-[#F5EFE6]/40">
                  You can still complete the session — biometrics and notes will be captured.
                </p>
              </div>
            ) : (
              <iframe src={conversationUrl} allow="microphone; camera" className="w-full h-full border-none" title="Tavus" />
            )}
          </div>

          {/* Bottom Controls */}
          <div className="h-[88px] bg-white border-t border-[#E8E1D7] flex items-center justify-center gap-4 px-6 relative">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-[#E8E1D7] text-[#2D2626] hover:bg-black/5">
              <Mic className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-[#E8E1D7] text-[#2D2626] hover:bg-black/5">
              <Video className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-[#E8E1D7] text-[#2D2626] hover:bg-black/5">
              <Settings className="h-5 w-5" />
            </Button>
            <Button 
              className="h-12 px-8 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium ml-4 shadow-sm"
              onClick={handleEndSession}
              disabled={endSession.isPending || isEndingRef.current}
            >
              {endSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Right Sidebar - Vitals & Transcript */}
        <div className="w-[360px] bg-white rounded-2xl border border-[#E8E1D7] shadow-sm flex flex-col overflow-hidden">
          <div className="flex border-b border-[#E8E1D7]">
            <button className="flex-1 py-4 text-[13px] font-medium text-[#2D2626] border-b-2 border-[#9B7250] bg-black/5">Live Vitals</button>
            <button className="flex-1 py-4 text-[13px] font-medium text-[#5C544F] border-b-2 border-transparent hover:bg-black/5">Transcript</button>
          </div>
          
          <div className="flex-1 overflow-auto p-6 space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-[#5C544F] mb-4">Biometrics</p>
              
              <div className="space-y-4">
                {/* HR Card */}
                <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                      <HeartPulse className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs text-[#5C544F] font-medium">Heart Rate</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-serif font-medium text-[#2D2626]">{latestHr}</span>
                        <span className="text-xs text-[#5C544F]">bpm</span>
                      </div>
                    </div>
                  </div>
                  {/* Sparkline mock */}
                  <div className="w-16 h-8 text-red-500">
                    <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                      <polyline points="0,15 20,10 40,25 60,5 80,20 100,15" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                </div>

                {/* HRV Card */}
                <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-[#5C544F] font-medium">HRV</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-serif font-medium text-[#2D2626]">{latestHrv}</span>
                        <span className="text-xs text-[#5C544F]">ms</span>
                      </div>
                    </div>
                  </div>
                  {/* Line mock */}
                  <div className="w-16 h-8 text-blue-500">
                    <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                      <polyline points="0,20 20,25 40,15 60,20 80,10 100,15" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                </div>

                {/* Stress Score */}
                <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#5C544F] font-medium">Stress Score (Live)</span>
                    <span className="text-amber-600 font-medium">Elevated</span>
                  </div>
                  <div className="h-2 w-full bg-[#E8E1D7] rounded-full overflow-hidden flex">
                    <div className="h-full bg-amber-500 w-[65%]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E8E1D7]">
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs font-mono uppercase tracking-wider text-[#5C544F]">Key Extracts</p>
                <span className="text-[10px] bg-[#F5EFE6] text-[#9B7250] px-2 py-0.5 rounded-full font-medium">Auto-tagging</span>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <span className="text-[10px] font-mono text-[#A09890] mt-0.5">04:12</span>
                  <p className="text-[13px] text-[#2D2626] leading-relaxed border-l-2 border-[#9B7250] pl-2">
                    Patient mentions severe anxiety relating to work deadlines. <span className="text-red-500 font-medium">+15% HR spike</span>
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-[10px] font-mono text-[#A09890] mt-0.5">08:45</span>
                  <p className="text-[13px] text-[#2D2626] leading-relaxed border-l-2 border-[#D5CFC6] pl-2">
                    Reports sleeping 4-5 hours per night over the last three weeks.
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-[10px] font-mono text-[#A09890] mt-0.5">11:20</span>
                  <p className="text-[13px] text-[#2D2626] leading-relaxed border-l-2 border-[#9B7250] pl-2">
                    Describes feelings of overwhelm and sudden chest tightness. <span className="text-red-500 font-medium">+22% HR spike</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-[#E8E1D7] bg-[#FAFAF9]">
            <Button 
              className="w-full bg-[#9B7250] hover:bg-[#8B6B5D] text-white rounded-xl h-11 text-[14px] font-medium"
              onClick={handleEndSession}
              disabled={endSession.isPending || isEndingRef.current}
            >
              {endSession.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Generate Clinical Brief
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
