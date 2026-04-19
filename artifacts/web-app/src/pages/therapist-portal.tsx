import React, { useState, useEffect } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@clerk/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, User, Search, Plus, Calendar, Filter, FileText, CheckCircle2, ChevronRight, MessageSquare, Download, AlertTriangle, TrendingUp, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SessionEntry = {
  session: {
    id: number;
    label: string | null;
    startedAt: string;
    endedAt: string | null;
    clinicalBrief: any | null;
  };
  patient: {
    id: number;
    name: string;
    demographics: any;
    createdAt: string;
  } | null;
  biometrics: any[];
};

export default function TherapistPortal() {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [therapistName, setTherapistName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/therapist/my-patients", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.patients ?? []);
        setTherapistName(data.therapist?.name ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isSignedIn]);

  if (!isLoaded || userLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (user && user.role !== "therapist") return <Redirect to="/portal" />;

  const lastName = therapistName ? therapistName.split(" ").pop() : "";

  return (
    <div className="flex flex-col xl:flex-row gap-8 max-w-[1600px] mx-auto">
      <div className="flex-1 flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-medium text-[#2D2626]">
              Welcome back, Dr. {lastName}.
            </h1>
            <p className="text-[#5C544F] mt-1 flex items-center gap-1.5">
              You have <span className="font-medium text-[#9B7250]">3 priority alerts</span> today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-xl h-10 border-[#E8E1D7] text-[#2D2626] font-medium hidden sm:flex">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="rounded-xl h-10 bg-[#9B7250] hover:bg-[#8B6B5D] font-medium">
              <Plus className="h-4 w-4 mr-2" />
              New Patient
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-[#5C544F] uppercase tracking-wider">Total Patients</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +12%
                </span>
              </div>
              <p className="font-serif text-[2.5rem] font-medium text-[#2D2626] leading-none">148</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/50 shadow-sm bg-[#FFF8F8] border-red-100">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-red-900/70 uppercase tracking-wider">High Priority</span>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <p className="font-serif text-[2.5rem] font-medium text-red-700 leading-none">12</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-[#5C544F] uppercase tracking-wider">Pending Intakes</span>
                <FileText className="h-4 w-4 text-[#9B7250]" />
              </div>
              <p className="font-serif text-[2.5rem] font-medium text-[#2D2626] leading-none">4</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#5C544F] uppercase tracking-wider">Session Volume</span>
              </div>
              <div className="mt-auto">
                <svg viewBox="0 0 100 30" className="w-full h-10 text-[#9B7250]" preserveAspectRatio="none">
                  <path d="M0,30 L10,25 L20,28 L30,15 L40,20 L50,10 L60,18 L70,5 L80,12 L90,2 L100,8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Patient List */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-white border border-[#E8E1D7] rounded-xl p-1 overflow-x-auto hide-scrollbar">
              <button className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[#F5EFE6] text-[#9B7250] whitespace-nowrap">All Patients</button>
              <button className="px-4 py-1.5 text-sm font-medium rounded-lg text-[#5C544F] hover:bg-black/5 whitespace-nowrap">Active</button>
              <button className="px-4 py-1.5 text-sm font-medium rounded-lg text-[#5C544F] hover:bg-black/5 whitespace-nowrap">New Intakes</button>
              <button className="px-4 py-1.5 text-sm font-medium rounded-lg text-[#5C544F] hover:bg-black/5 whitespace-nowrap">Needs Follow-up</button>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search patients..." className="pl-9 h-10 rounded-xl border-[#E8E1D7]" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {entries.length === 0 ? (
              <div className="col-span-2 p-12 text-center border border-border/50 rounded-2xl bg-white">
                <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-2">No patients assigned yet</h3>
                <p className="text-sm text-muted-foreground">Patients will appear here once they complete their intake and are matched with you.</p>
              </div>
            ) : (
              entries.map((entry, i) => (
                <div key={entry.session.id} className="bg-white rounded-2xl border border-border/50 shadow-sm p-5 hover:border-[#9B7250]/30 transition-colors group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-border/50">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${entry.patient?.name ?? 'Anon'}&backgroundColor=f0e6e6&textColor=2d2626`} />
                        <AvatarFallback>{entry.patient?.name?.charAt(0) ?? 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-[#2D2626] text-[15px]">{entry.patient?.name ?? "Anonymous Patient"}</h3>
                        <p className="text-xs text-[#5C544F] font-mono">ID: {10000 + (entry.patient?.id ?? i)}</p>
                      </div>
                    </div>
                    {entry.session.endedAt ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-100">
                        Intake Pending
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-medium text-[#5C544F] mb-1">Last Session</p>
                      <p className="text-sm text-[#2D2626]">
                        {new Date(entry.session.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-medium text-[#5C544F] mb-1">Clinical Profile</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[11px] bg-[#F5EFE6] text-[#9B7250] px-1.5 py-0.5 rounded">
                          #{entry.session.clinicalBrief?.clinicalProfile?.split('-')[0] ?? 'general'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-[#E8E1D7]">
                    <Link href={`/therapist-portal/sessions/${entry.session.id}`} className="flex-1">
                      <Button variant="outline" className="w-full h-9 rounded-lg border-[#E8E1D7] text-[13px] font-medium text-[#2D2626]">
                        Open Brief
                      </Button>
                    </Link>
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-[#E8E1D7] text-[#5C544F]">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full xl:w-[320px] flex flex-col gap-6">
        <Card className="rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="bg-[#FAFAF9] border-b border-[#E8E1D7] px-5 py-4 flex items-center justify-between">
            <h3 className="font-medium text-[#2D2626]">Checklist</h3>
            <span className="text-xs font-medium bg-[#F5EFE6] text-[#9B7250] px-2 py-0.5 rounded-full">4 pending</span>
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-[#E8E1D7]">
              <div className="p-4 hover:bg-black/5 transition-colors cursor-pointer flex items-start gap-3">
                <div className="h-5 w-5 rounded border border-[#D5CFC6] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-[#2D2626] leading-tight mb-1">Review new intake: Michael R.</p>
                  <span className="text-[10px] font-bold uppercase text-red-600">Due Today</span>
                </div>
              </div>
              <div className="p-4 hover:bg-black/5 transition-colors cursor-pointer flex items-start gap-3">
                <div className="h-5 w-5 rounded border border-[#D5CFC6] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-[#2D2626] leading-tight mb-1">Finalize notes for Sarah T.</p>
                  <span className="text-[10px] font-bold uppercase text-red-600">Due Today</span>
                </div>
              </div>
              <div className="p-4 hover:bg-black/5 transition-colors cursor-pointer flex items-start gap-3">
                <div className="h-5 w-5 rounded border border-[#D5CFC6] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-[#2D2626] leading-tight mb-1">Sign treatment plan for David L.</p>
                  <span className="text-[10px] font-bold uppercase text-[#9B7250]">Tomorrow</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="bg-[#FAFAF9] border-b border-[#E8E1D7] px-5 py-4 flex items-center justify-between">
            <h3 className="font-medium text-[#2D2626]">Upcoming</h3>
            <Calendar className="h-4 w-4 text-[#5C544F]" />
          </div>
          <CardContent className="p-0">
            <div className="divide-y divide-[#E8E1D7]">
              <div className="p-4 hover:bg-black/5 transition-colors cursor-pointer">
                <p className="text-xs font-medium text-[#9B7250] mb-1">10:00 AM - 10:50 AM</p>
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-medium text-[#2D2626]">Elena M. (Session 4)</p>
                  <Video className="h-4 w-4 text-[#5C544F]" />
                </div>
              </div>
              <div className="p-4 hover:bg-black/5 transition-colors cursor-pointer">
                <p className="text-xs font-medium text-[#9B7250] mb-1">11:30 AM - 12:20 PM</p>
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-medium text-[#2D2626]">Marcus C. (Intake Review)</p>
                  <Video className="h-4 w-4 text-[#5C544F]" />
                </div>
              </div>
              <div className="p-4 hover:bg-black/5 transition-colors cursor-pointer">
                <p className="text-xs font-medium text-[#9B7250] mb-1">2:00 PM - 2:50 PM</p>
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-medium text-[#2D2626]">Jennifer P. (Session 12)</p>
                  <Video className="h-4 w-4 text-[#5C544F]" />
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-[#E8E1D7]">
              <Button variant="ghost" className="w-full text-xs font-medium text-[#5C544F]">View Full Schedule</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
