import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Clock, Brain, HeartPulse, FileText, Users, Play, Activity } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col bg-[#F5EFE6] min-h-screen">
      {/* HERO */}
      <section className="w-full px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="container max-w-screen-xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 max-w-xl">
            <h1 className="font-serif text-5xl md:text-6xl lg:text-[4.5rem] font-medium tracking-tight text-[#2D2626] leading-[1.05] mb-6">
              A conversation,<br />
              <span className="italic text-[#8B6B5D]">not a questionnaire.</span>
            </h1>
            <p className="text-base md:text-lg text-[#5C544F] leading-relaxed mb-10">
              Anamnesis brings structured clinical conversation to your intake process, generating comprehensive SOAP notes and biomarker insights before the first session.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="rounded-full h-12 px-8 text-[15px] font-medium bg-[#9B7250] hover:bg-[#8B6B5D] text-white">
                  Get Started
                </Button>
              </Link>
              <Link href="/intake/new">
                <Button size="lg" variant="outline" className="rounded-full h-12 px-8 text-[15px] font-medium border-[#D5CFC6] bg-transparent text-[#2D2626] hover:bg-black/5">
                  Try Demo Intake
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="flex-1 w-full relative">
            {/* Brand visual: a stylised "intake session" preview, no stock imagery */}
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-[#E8E1D7] aspect-[4/3] bg-gradient-to-br from-[#2D2626] via-[#3a302a] to-[#5C4537] p-8 flex flex-col justify-between">
              {/* Top: session chrome */}
              <div className="flex items-center justify-between text-[#F5EFE6]/80">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Session in progress
                </div>
                <span className="font-mono text-xs text-[#F5EFE6]/60">14:23</span>
              </div>

              {/* Center: serif quote rising out of the conversation */}
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-[#F5EFE6]/10 border border-[#F5EFE6]/15 flex items-center justify-center mb-5">
                  <span className="font-serif italic text-3xl text-[#F5EFE6] leading-none -mt-1">A</span>
                </div>
                <p className="font-serif italic text-xl md:text-2xl text-[#F5EFE6] leading-snug max-w-sm">
                  &ldquo;What brought you here today?&rdquo;
                </p>
                <p className="text-xs font-mono uppercase tracking-wider text-[#F5EFE6]/50 mt-3">
                  Sakinah · Conversational Companion
                </p>
              </div>

              {/* Bottom: live waveform + vitals strip */}
              <div className="flex items-end justify-between gap-4 text-[#F5EFE6]/70">
                <div className="flex items-end gap-1 h-7">
                  {[3, 6, 4, 8, 5, 10, 6, 12, 7, 9, 5, 7, 4, 8, 5].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-[#F5EFE6]/60 rounded-full animate-[pulse_1.6s_ease-in-out_infinite]"
                      style={{ height: `${h * 2}px`, animationDelay: `${i * 0.08}s` }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <HeartPulse className="h-3.5 w-3.5 text-[#E8B7A0]" />
                    <span className="font-mono">72 bpm</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-[#A8C5E0]" />
                    <span className="font-mono">48 ms</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg border border-[#E8E1D7] p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-[#F5EFE6] flex items-center justify-center">
                <HeartPulse className="h-5 w-5 text-[#9B7250]" />
              </div>
              <div>
                <p className="text-xs text-[#5C544F] uppercase tracking-wider font-mono">Biomarkers</p>
                <p className="font-medium text-[#2D2626]">Live stress tracking</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 CARD GRID */}
      <section className="w-full px-6 py-20 bg-white">
        <div className="container max-w-screen-xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-[2.75rem] font-medium text-[#2D2626] leading-tight mb-4">
              A complete clinical picture
            </h2>
            <p className="text-[#5C544F] text-lg max-w-2xl mx-auto">
              We capture the nuance of a real conversation and combine it with physiological data to give providers the context they need.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#F8F9FA] rounded-2xl p-8 border border-[#E8E1D7]">
              <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-[#E8E1D7]">
                <Brain className="h-5 w-5 text-[#9B7250]" />
              </div>
              <h3 className="font-serif text-2xl font-medium text-[#2D2626] mb-3">Conversational Intake</h3>
              <p className="text-[#5C544F] leading-relaxed">
                Patients speak naturally with our AI avatar. The system asks dynamic follow-up questions based on clinical presentation.
              </p>
            </div>
            
            <div className="bg-[#F8F9FA] rounded-2xl p-8 border border-[#E8E1D7]">
              <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-[#E8E1D7]">
                <FileText className="h-5 w-5 text-[#9B7250]" />
              </div>
              <h3 className="font-serif text-2xl font-medium text-[#2D2626] mb-3">Automated SOAP Notes</h3>
              <p className="text-[#5C544F] leading-relaxed">
                The entire session is synthesized into a standardized clinical brief, ready for the provider before the first appointment.
              </p>
            </div>
            
            <div className="bg-[#F8F9FA] rounded-2xl p-8 border border-[#E8E1D7]">
              <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-[#E8E1D7]">
                <Activity className="h-5 w-5 text-[#9B7250]" />
              </div>
              <h3 className="font-serif text-2xl font-medium text-[#2D2626] mb-3">Biometric Heat Maps</h3>
              <p className="text-[#5C544F] leading-relaxed">
                Correlate physiological stress responses to specific topics during the interview using smartwatch telemetry.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST SECTION */}
      <section className="w-full px-6 py-24 bg-[#2D2626] text-[#F5EFE6]">
        <div className="container max-w-screen-xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-[2.75rem] font-medium leading-tight mb-12">
            Clinical posture you can trust.
          </h2>
          <div className="flex flex-wrap justify-center gap-8 opacity-80">
            <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-full border border-white/20">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-mono text-sm tracking-wider uppercase">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-full border border-white/20">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-mono text-sm tracking-wider uppercase">SOC2 Type II</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-full border border-white/20">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-mono text-sm tracking-wider uppercase">End-to-End Encrypted</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full px-6 py-12 bg-white border-t border-[#E8E1D7]">
        <div className="container max-w-screen-xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-full bg-[#9B7250] flex items-center justify-center">
              <span className="font-serif italic text-sm text-white leading-none -mt-0.5">A</span>
            </div>
            <span className="font-serif text-lg font-medium text-[#2D2626]">Anamnesis</span>
          </div>
          
          <div className="flex gap-8 text-sm text-[#5C544F]">
            <a href="#" className="hover:text-[#2D2626]">Privacy Policy</a>
            <a href="#" className="hover:text-[#2D2626]">Terms of Service</a>
            <a href="#" className="hover:text-[#2D2626]">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}