import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useGetSessionBrief, getGetSessionBriefQueryKey } from "@workspace/api-client-react";
import { Loader2, Bell, Settings, Mic, Video, PhoneOff, Maximize, Activity, FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function TherapistPortalSession() {
  const params = useParams();
  const sessionId = Number(params.sessionId);

  const { data: session, isLoading } = useGetSessionBrief(sessionId, {
    query: { queryKey: getGetSessionBriefQueryKey(sessionId), enabled: !!sessionId },
  });

  const [activeTab, setActiveTab] = useState("Intake");

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[100dvh]">
        <p className="text-muted-foreground">Session not found.</p>
        <Link href="/therapist-portal">
          <Button variant="outline" className="mt-4">Back to portal</Button>
        </Link>
      </div>
    );
  }

  const patientName = "Sarah Jenkins"; // mocked for now

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] bg-[#F8F9FA] overflow-hidden p-6 gap-6 max-w-[1600px] mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-2xl border border-[#E8E1D7] px-6 py-4 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium text-[#2D2626]">Active Session</span>
          </div>
          <div className="h-4 w-[1px] bg-[#E8E1D7]" />
          <div className="flex items-center gap-2">
            {["Intake", "Assessment", "Diagnosis", "Treatment Plan"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeTab === tab ? "bg-[#F5EFE6] text-[#9B7250]" : "text-[#5C544F] hover:bg-black/5"}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-[#5C544F] hover:text-[#2D2626]">
            <Bell className="h-5 w-5" />
          </button>
          <button className="text-[#5C544F] hover:text-[#2D2626]">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-6">
        
        {/* Left Column: Patient Profile */}
        <div className="w-[320px] flex flex-col gap-6 overflow-y-auto hide-scrollbar">
          <div className="bg-white rounded-2xl border border-[#E8E1D7] shadow-sm p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <Avatar className="h-20 w-20 border-2 border-white shadow-sm mb-3">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${patientName}&backgroundColor=f0e6e6&textColor=2d2626`} />
                <AvatarFallback>{patientName.charAt(0)}</AvatarFallback>
              </Avatar>
              <h2 className="font-medium text-lg text-[#2D2626]">{patientName}</h2>
              <p className="text-sm text-[#5C544F]">ID: 10482 • {session.clinicalBrief?.clinicalProfile?.split('-')[0] ?? 'General'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[#5C544F] mb-1 font-medium">Age</p>
                <p className="text-sm font-medium text-[#2D2626]">32 yrs</p>
              </div>
              <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[#5C544F] mb-1 font-medium">Weight</p>
                <p className="text-sm font-medium text-[#2D2626]">145 lbs</p>
              </div>
              <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[#5C544F] mb-1 font-medium">Height</p>
                <p className="text-sm font-medium text-[#2D2626]">5'6"</p>
              </div>
              <div className="bg-[#FAFAF9] border border-[#E8E1D7] rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[#5C544F] mb-1 font-medium">Blood</p>
                <p className="text-sm font-medium text-[#2D2626]">A+</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-[#5C544F] mb-3">Appointments</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#E8E1D7] bg-[#FAFAF9]">
                    <div>
                      <p className="text-sm font-medium text-[#2D2626]">Initial Intake</p>
                      <p className="text-xs text-[#5C544F]">Oct 12, 2023</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#9B7250] bg-[#F5EFE6]/50">
                    <div>
                      <p className="text-sm font-medium text-[#2D2626]">Session 1 (Current)</p>
                      <p className="text-xs text-[#5C544F]">Today, 10:00 AM</p>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-[#9B7250]" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E8E1D7]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-mono uppercase tracking-wider text-[#5C544F]">Vocal Biomarkers</p>
                  <span className="text-[10px] font-bold text-red-600 uppercase">Live</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#5C544F]">Tremor Level</span>
                      <span className="font-medium text-[#2D2626]">Elevated</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#E8E1D7] rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 w-[65%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#5C544F]">Pitch Variance</span>
                      <span className="font-medium text-[#2D2626]">Low</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#E8E1D7] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 w-[30%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Video Area */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-[#E8E1D7] shadow-sm overflow-hidden relative">
          <div className="absolute top-4 left-4 z-10">
            <div className="bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Recording Active
            </div>
          </div>
          <div className="absolute top-4 right-4 z-10">
            <button className="h-8 w-8 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-black/60 transition-colors">
              <Maximize className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 relative bg-[#E8E1D7]">
            <img 
              src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=1200" 
              alt="Video Feed"
              className="w-full h-full object-cover mix-blend-multiply opacity-90"
            />
            
            {/* Live Caption Box */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg">
              <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 text-center border border-white/10">
                <p className="text-white font-medium text-[15px] drop-shadow-md">
                  "I just feel this constant tightness in my chest when I wake up. It makes it hard to focus on getting the kids ready."
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="h-[88px] bg-white border-t border-[#E8E1D7] flex items-center justify-center gap-4 px-6">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-[#E8E1D7] text-[#2D2626] hover:bg-black/5">
              <Mic className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-[#E8E1D7] text-[#2D2626] hover:bg-black/5">
              <Video className="h-5 w-5" />
            </Button>
            <Button className="h-12 px-8 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium ml-4 shadow-sm">
              <PhoneOff className="h-5 w-5 mr-2" />
              End Session
            </Button>
          </div>
        </div>

        {/* Right Column: Clinical Brief */}
        <div className="w-[360px] bg-white rounded-2xl border border-[#E8E1D7] shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-[#E8E1D7] bg-[#FAFAF9] flex items-center justify-between">
            <h3 className="font-medium text-[#2D2626]">Clinical Brief</h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#9B7250] bg-[#F5EFE6] px-2 py-0.5 rounded">Auto-Draft</span>
          </div>

          <div className="flex-1 overflow-auto p-5 space-y-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-[#5C544F] mb-2">Primary Complaint</p>
              <div className="bg-[#F5EFE6] text-[#9B7250] text-sm font-medium px-3 py-2 rounded-lg inline-block">
                Generalized Anxiety / Morning Panic
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#9B7250] mb-2">Subjective (Draft)</p>
                <div className="text-[13px] text-[#2D2626] leading-relaxed font-mono bg-[#FAFAF9] border border-[#E8E1D7] p-3 rounded-lg whitespace-pre-wrap">
                  Patient reports persistent morning anxiety characterized by "chest tightness" and difficulty focusing. Symptoms have been present for ~3 weeks. Exacerbated by morning routine tasks.
                </div>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#9B7250] mb-2">Objective (Draft)</p>
                <div className="text-[13px] text-[#2D2626] leading-relaxed font-mono bg-[#FAFAF9] border border-[#E8E1D7] p-3 rounded-lg">
                  Patient appears mildly restless. Vocal tremor detected during discussion of morning routines. Baseline HR: 72bpm. Spiked to 88bpm (+22%) when describing chest tightness.
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E8E1D7]">
              <p className="text-xs font-mono uppercase tracking-wider text-[#5C544F] mb-3">Distress Level</p>
              <div className="flex gap-1 h-3 w-full">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                  <div 
                    key={i} 
                    className={`flex-1 rounded-sm ${i <= 7 ? (i > 5 ? "bg-amber-400" : "bg-emerald-400") : "bg-[#E8E1D7]"}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[#5C544F] mt-1 font-medium">
                <span>Mild</span>
                <span>Moderate (7/10)</span>
                <span>Severe</span>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-[#E8E1D7] bg-[#FAFAF9]">
            <Button className="w-full bg-[#2D2626] hover:bg-black text-white h-11 rounded-xl text-[14px] font-medium shadow-sm">
              <FileText className="h-4 w-4 mr-2" />
              Finalize Notes
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
