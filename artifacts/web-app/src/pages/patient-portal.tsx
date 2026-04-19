import React, { useState, useEffect } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, CheckCircle2, Loader2, FileText, Calendar as CalendarIcon, Activity, Users, Play, HeartPulse, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function PatientPortal() {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [, setLocation] = useLocation();

  if (!isLoaded || userLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (user && user.role !== "patient") return <Redirect to="/portal" />;

  const patientName = (user?.record as any)?.name ?? "there";
  const firstName = patientName !== "there" ? patientName.split(" ")[0] : "";

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-[1400px] mx-auto">
      <div className="flex-1 flex flex-col gap-8">
        
        {/* Greeting & CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-8 border border-border/50 shadow-sm">
          <div>
            <h1 className="font-serif text-3xl font-medium text-[#2D2626]">
              Good morning, {firstName}
            </h1>
            <p className="text-[#5C544F] mt-1">Your next session is ready to begin.</p>
          </div>
          <Link href="/intake/new">
            <Button className="rounded-xl h-12 px-6 text-[15px] font-medium bg-[#9B7250] hover:bg-[#8B6B5D]">
              Start Conversational Intake
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 text-sm font-medium text-[#5C544F] mb-4">
              <CalendarIcon className="h-4 w-4 text-[#9B7250]" />
              Next Session
            </div>
            <div className="mt-auto">
              <p className="font-serif text-3xl font-medium text-[#2D2626]">2<span className="text-xl text-[#5C544F]">d</span></p>
              <p className="text-xs text-[#5C544F] mt-1">Dr. Sarah Jenkins</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 text-sm font-medium text-[#5C544F] mb-4">
              <FileText className="h-4 w-4 text-[#9B7250]" />
              Clinical Briefs
            </div>
            <div className="mt-auto">
              <p className="font-serif text-3xl font-medium text-[#2D2626]">4</p>
              <p className="text-xs text-[#5C544F] mt-1">Generated this year</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 text-sm font-medium text-[#5C544F] mb-4">
              <Activity className="h-4 w-4 text-[#9B7250]" />
              Avg Heart Rate
            </div>
            <div className="mt-auto">
              <p className="font-serif text-3xl font-medium text-[#2D2626]">72<span className="text-xl text-[#5C544F]">bpm</span></p>
              <p className="text-xs text-[#5C544F] mt-1">During active intake</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 text-sm font-medium text-[#5C544F] mb-4">
              <Users className="h-4 w-4 text-[#9B7250]" />
              Matched Providers
            </div>
            <div className="mt-auto">
              <p className="font-serif text-3xl font-medium text-[#2D2626]">12</p>
              <p className="text-xs text-[#5C544F] mt-1">In your network</p>
            </div>
          </div>
        </div>

        {/* Video Session Panel */}
        <div className="bg-white rounded-2xl overflow-hidden border border-border/50 shadow-sm">
          <div className="relative aspect-[21/9] bg-[#E8E1D7]">
            <img 
              src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=1200" 
              alt="Video session preview"
              className="w-full h-full object-cover mix-blend-multiply opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform">
                <Play className="h-6 w-6 text-[#9B7250] ml-1" />
              </div>
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <div className="bg-white/90 backdrop-blur rounded-xl p-4 max-w-xl shadow-lg">
                <p className="text-[15px] text-[#2D2626] font-medium mb-1">Dr. Tavus (AI Intake)</p>
                <p className="text-sm text-[#5C544F]">"That makes complete sense. When you experience those moments of heightened anxiety, do you notice any physical symptoms?"</p>
              </div>
            </div>
          </div>
          <div className="p-6 flex items-center justify-between border-t border-border/50">
            <div>
              <h3 className="font-medium text-[#2D2626]">Incomplete Intake Session</h3>
              <p className="text-sm text-[#5C544F]">Started Oct 24, 2023 • ~12 mins remaining</p>
            </div>
            <Link href="/intake/resume">
              <Button variant="outline" className="rounded-xl border-[#E8E1D7] text-[14px] font-medium h-10">
                Resume Dialogue
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <SessionsList />
        </div>
      </div>

      {/* Right Sidebar - AI Matches */}
      <div className="w-full lg:w-[340px] flex flex-col gap-6">
        <div className="bg-white rounded-2xl p-6 border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-2 w-2 rounded-full bg-[#9B7250]" />
            <h2 className="font-medium text-xs tracking-widest uppercase text-[#5C544F]">AI Matches — Suggested Providers</h2>
          </div>
          
          <div className="space-y-4">
            <div className="group cursor-pointer rounded-xl p-4 border border-transparent hover:border-[#E8E1D7] hover:bg-[#F8F9FA] transition-all">
              <div className="flex items-center gap-4 mb-3">
                <Avatar className="h-12 w-12 border border-border/50">
                  <AvatarImage src="https://api.dicebear.com/7.x/initials/svg?seed=SJ&backgroundColor=f0e6e6&textColor=2d2626" />
                  <AvatarFallback>SJ</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-[#2D2626] text-[15px] group-hover:text-[#9B7250] transition-colors">Dr. Sarah Jenkins</h3>
                  <p className="text-xs text-[#5C544F]">Clinical Psychologist</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-full bg-[#F5EFE6] px-2.5 py-1 text-[10px] font-medium text-[#9B7250]">94% Match</span>
                <span className="inline-flex items-center rounded-full bg-[#F8F9FA] border border-[#E8E1D7] px-2.5 py-1 text-[10px] font-medium text-[#5C544F]">Anxiety</span>
              </div>
            </div>

            <div className="h-[1px] w-full bg-border/50" />

            <div className="group cursor-pointer rounded-xl p-4 border border-transparent hover:border-[#E8E1D7] hover:bg-[#F8F9FA] transition-all">
              <div className="flex items-center gap-4 mb-3">
                <Avatar className="h-12 w-12 border border-border/50">
                  <AvatarImage src="https://api.dicebear.com/7.x/initials/svg?seed=MC&backgroundColor=f0e6e6&textColor=2d2626" />
                  <AvatarFallback>MC</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-[#2D2626] text-[15px] group-hover:text-[#9B7250] transition-colors">Marcus Chen, LMFT</h3>
                  <p className="text-xs text-[#5C544F]">Marriage & Family Therapist</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-full bg-[#F5EFE6] px-2.5 py-1 text-[10px] font-medium text-[#9B7250]">88% Match</span>
                <span className="inline-flex items-center rounded-full bg-[#F8F9FA] border border-[#E8E1D7] px-2.5 py-1 text-[10px] font-medium text-[#5C544F]">Relationships</span>
              </div>
            </div>

            <div className="h-[1px] w-full bg-border/50" />

            <div className="group cursor-pointer rounded-xl p-4 border border-transparent hover:border-[#E8E1D7] hover:bg-[#F8F9FA] transition-all">
              <div className="flex items-center gap-4 mb-3">
                <Avatar className="h-12 w-12 border border-border/50">
                  <AvatarImage src="https://api.dicebear.com/7.x/initials/svg?seed=EP&backgroundColor=f0e6e6&textColor=2d2626" />
                  <AvatarFallback>EP</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-[#2D2626] text-[15px] group-hover:text-[#9B7250] transition-colors">Dr. Elena Patel</h3>
                  <p className="text-xs text-[#5C544F]">Psychiatrist</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-full bg-[#F5EFE6] px-2.5 py-1 text-[10px] font-medium text-[#9B7250]">82% Match</span>
                <span className="inline-flex items-center rounded-full bg-[#F8F9FA] border border-[#E8E1D7] px-2.5 py-1 text-[10px] font-medium text-[#5C544F]">Depression</span>
              </div>
            </div>
          </div>
          
          <Link href="/therapists">
            <Button variant="ghost" className="w-full mt-4 text-[#9B7250] hover:text-[#8B6B5D] hover:bg-[#F5EFE6]">
              View All Matches
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function SessionsList() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patient/my-sessions", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-2xl font-medium text-[#2D2626]">Recent Sessions</h2>
        <Link href="/sessions" className="text-sm font-medium text-[#9B7250] hover:text-[#8B6B5D]">
          View all
        </Link>
      </div>
      {sessions.slice(0, 3).map((session: any) => {
        const isComplete = !!session.endedAt;
        const date = new Date(session.startedAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });
        return (
          <div key={session.id} className="bg-white border border-border/50 rounded-xl p-5 flex items-center justify-between hover:border-[#9B7250]/50 transition-colors cursor-pointer" onClick={() => isComplete ? window.location.href = `/intake/${session.id}/brief` : window.location.href = `/intake/${session.id}`}>
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isComplete ? "bg-[#F5EFE6] text-[#9B7250]" : "bg-[#F8F9FA] border border-[#E8E1D7] text-[#5C544F]"}`}>
                {isComplete ? <FileText className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
              <div>
                <p className="font-medium text-[#2D2626] text-[15px]">
                  {session.label ?? `Intake Session #${session.id}`}
                </p>
                <p className="text-xs text-[#5C544F] mt-0.5">{date} • {isComplete ? "Completed" : "In progress"}</p>
              </div>
            </div>
            {isComplete ? (
              <span className="text-sm font-medium text-[#9B7250] flex items-center gap-1">
                View Brief <ArrowRight className="h-4 w-4" />
              </span>
            ) : (
              <span className="text-sm font-medium text-[#5C544F] flex items-center gap-1">
                Resume <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
