import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Clock, Brain, HeartPulse, FileText, Users } from "lucide-react";

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 py-8 md:py-0">
      <span className="font-serif text-5xl font-medium text-foreground tracking-tight">{value}</span>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function FeatureRow({
  kicker,
  heading,
  body,
  bullets,
  icon: Icon,
  flip,
}: {
  kicker: string;
  heading: string;
  body: string;
  bullets: string[];
  icon: React.ElementType;
  flip?: boolean;
}) {
  return (
    <div className={`grid md:grid-cols-2 gap-12 md:gap-20 items-center ${flip ? "md:[&>*:first-child]:order-2" : ""}`}>
      <div className="flex flex-col gap-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{kicker}</p>
        <h3 className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight">{heading}</h3>
        <p className="text-muted-foreground leading-relaxed text-[15px]">{body}</p>
        <ul className="flex flex-col gap-2.5 mt-1">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-muted/40 border border-border/60 rounded-xl p-10 flex items-center justify-center min-h-[280px]">
        <div className="flex flex-col items-start gap-4 w-full max-w-xs">
          <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{kicker}</p>
          <div className="w-full space-y-2">
            <div className="h-2 bg-primary/20 rounded-sm w-full" />
            <div className="h-2 bg-primary/10 rounded-sm w-4/5" />
            <div className="h-2 bg-primary/10 rounded-sm w-3/5" />
          </div>
          <div className="flex gap-2 mt-2">
            <div className="h-6 w-16 bg-primary/15 rounded-sm" />
            <div className="h-6 w-12 bg-border rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col">

      {/* HERO */}
      <section className="w-full px-4 pt-20 pb-20 md:pt-32 md:pb-28 border-b border-border/50">
        <div className="container max-w-screen-xl mx-auto">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-7">
              Clinical Intake Intelligence Platform
            </p>
            <h1 className="font-serif text-5xl md:text-7xl font-medium tracking-tight text-foreground leading-[1.05] mb-7">
              The intake session,<br />rebuilt from first<br />principles.
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mb-10">
              Anamnesis replaces 45-minute manual intakes with an AI-led video conversation that captures clinical depth, biometric context, and patient history — then routes to the right provider automatically.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/intake/new">
                <Button size="lg" className="rounded-md h-12 px-7 text-sm font-medium">
                  Start intake <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href="/therapists" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                Browse our providers
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* STAT BAR */}
      <section className="w-full px-4 py-6 border-b border-border/50 bg-muted/20">
        <div className="container max-w-screen-xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y-2 md:divide-y-0 md:divide-x divide-border/40">
            <div className="py-6 md:py-0 md:pr-10">
              <Stat value="62%" label="Reduction in intake time" sub="vs. traditional paper + interview" />
            </div>
            <div className="py-6 md:py-0 md:px-10">
              <Stat value="3×" label="More clinical context" sub="delivered to providers before session one" />
            </div>
            <div className="py-6 md:py-0 md:px-10">
              <Stat value="50+" label="Verified providers" sub="across 14 clinical specialties" />
            </div>
            <div className="py-6 md:py-0 md:pl-10">
              <Stat value="94%" label="Match confidence" sub="outcome-weighted provider matching" />
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="w-full px-4 py-20 md:py-28 border-b border-border/50">
        <div className="container max-w-screen-xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">The problem</p>
              <h2 className="font-serif text-4xl md:text-5xl font-medium text-foreground leading-tight">
                Intake hasn't changed<br />in thirty years.
              </h2>
            </div>
            <div className="flex flex-col gap-7 pt-2">
              <div className="flex gap-5 items-start">
                <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-1">45 minutes of clinician time — before care starts</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The average mental health intake requires a trained clinician to conduct the session manually. That's billable time spent on administration, not treatment.
                  </p>
                </div>
              </div>
              <div className="flex gap-5 items-start">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-1">Paper forms miss what matters</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Checkbox-and-scale questionnaires produce surface-level data. They can't capture nuance, affect, or the physiological signals that predict treatment outcomes.
                  </p>
                </div>
              </div>
              <div className="flex gap-5 items-start">
                <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-1">Matching is guesswork</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Most platforms match patients to providers by specialty tag. No outcome correlation, no clinical weighting — just a directory search with a wellness filter.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="w-full px-4 py-20 md:py-28 bg-muted/20 border-b border-border/50">
        <div className="container max-w-screen-xl mx-auto">
          <div className="max-w-xl mb-14">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5">How it works</p>
            <h2 className="font-serif text-4xl md:text-5xl font-medium text-foreground leading-tight">
              From first contact to matched provider in under 30 minutes.
            </h2>
          </div>
          <div className="grid gap-0 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border/50">
            {[
              { n: "01", title: "Video intake", body: "A Tavus AI avatar conducts a structured clinical interview. No forms. Patients speak naturally — the system listens for clinical signal." },
              { n: "02", title: "Biometric capture", body: "Apple Watch streams HR and HRV data throughout. Physiological stress responses are correlated to conversation segments in real time." },
              { n: "03", title: "SOAP brief", body: "GPT-4o synthesizes the transcript and biometric data into a clinical SOAP note — delivered to the assigned provider before the first session." },
              { n: "04", title: "Outcome matching", body: "The patient is matched to a provider based on documented outcome rates with their specific clinical profile — not keyword overlap." },
            ].map((step) => (
              <div key={step.n} className="flex flex-col gap-3 py-8 md:py-0 md:first:pr-8 md:[&:not(:first-child)]:px-8 md:last:pl-8">
                <span className="font-mono text-xs text-muted-foreground">{step.n}</span>
                <h3 className="text-base font-medium text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="w-full px-4 py-20 md:py-28 border-b border-border/50">
        <div className="container max-w-screen-xl mx-auto flex flex-col gap-24">
          <FeatureRow
            kicker="AI video interview"
            heading="A clinical conversation, not a chatbot."
            body="Anamnesis uses Tavus's conversational video AI to conduct structured intake interviews. The avatar asks open-ended clinical questions, follows threads, and maintains therapeutic rapport — producing richer data than any form."
            bullets={[
              "Standardized DSM-aligned question sets",
              "Adaptive follow-up based on patient responses",
              "Full transcript retained for clinical review",
              "Patients complete intake on their own time",
            ]}
            icon={Brain}
          />
          <FeatureRow
            kicker="Biometric correlation"
            heading="Physiological signal, layered on narrative."
            body="Heart rate and HRV readings from Apple Watch are timestamped and mapped against conversation segments. Providers see exactly when stress responses spiked — and what was being discussed."
            bullets={[
              "Live HR and HRV capture via Apple Watch",
              "Segment-level correlation to transcript",
              "Autonomic stress markers flagged automatically",
              "Exportable biometric timeline for clinical records",
            ]}
            icon={HeartPulse}
            flip
          />
          <FeatureRow
            kicker="Clinical documentation"
            heading="Walk into session one already knowing the patient."
            body="GPT-4o reads the full transcript and biometric summary, then generates a structured SOAP note — Subjective, Objective, Assessment, Plan — ready for provider review before the first appointment."
            bullets={[
              "Full SOAP format with clinical language",
              "Biometric summary integrated into Objective section",
              "Differential considerations surfaced in Assessment",
              "One-click provider handoff",
            ]}
            icon={FileText}
          />
        </div>
      </section>

      {/* FOR CLINICS — B2B PITCH */}
      <section className="w-full px-4 py-20 md:py-28 bg-foreground text-background border-b border-border/50">
        <div className="container max-w-screen-xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 mb-6">For group practices & clinics</p>
              <h2 className="font-serif text-4xl md:text-5xl font-medium leading-tight mb-6">
                Scale intake capacity<br />without adding headcount.
              </h2>
              <p className="text-[15px] leading-relaxed opacity-70 mb-8">
                Anamnesis plugs into your existing workflow. New patients complete intake asynchronously. Your clinicians receive a SOAP brief and a matched referral — ready to schedule.
              </p>
              <Link href="/intake/new">
                <Button size="lg" className="rounded-md h-12 px-7 text-sm font-medium bg-background text-foreground hover:bg-background/90">
                  Try a demo intake
                </Button>
              </Link>
            </div>
            <div className="flex flex-col gap-5">
              {[
                { label: "Intake throughput", before: "8–12 per week per clinician", after: "Unlimited — async, AI-led" },
                { label: "Time to first session", before: "5–10 business days", after: "Same day or next day" },
                { label: "Documentation", before: "Manual note after intake call", after: "SOAP brief auto-generated" },
                { label: "Provider matching", before: "Admin coordinator judgment", after: "Outcome-weighted algorithm" },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-3 gap-4 py-4 border-b border-white/10 last:border-0">
                  <p className="text-xs font-medium opacity-60 col-span-1">{row.label}</p>
                  <p className="text-xs opacity-50 line-through col-span-1">{row.before}</p>
                  <p className="text-xs font-medium opacity-90 col-span-1">{row.after}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="w-full px-4 py-20 md:py-28 border-b border-border/50">
        <div className="container max-w-screen-xl mx-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-12">Early clinical feedback</p>
          <div className="grid md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-border/50">
            {[
              {
                quote: "I received a detailed SOAP note before my first session. I walked in already knowing the patient's history, presenting concerns, and stress markers. It changed how I prepare.",
                name: "Dr. Rachel Kim",
                title: "Licensed Psychologist, NY",
              },
              {
                quote: "The biometric correlation is what sets this apart. Seeing HR spike during a specific part of the transcript told me more than an hour of intake would have.",
                name: "Marcus Webb, LMFT",
                title: "Marriage & Family Therapist, CA",
              },
              {
                quote: "Our intake waitlist dropped from 12 days to under 48 hours. Patients complete it on their schedule, we get a complete clinical picture before they're even assigned.",
                name: "Dr. Priya Nair",
                title: "Clinical Director, Integrative Wellness Group",
              },
            ].map((t) => (
              <div key={t.name} className="flex flex-col gap-5 py-8 md:py-0 md:first:pr-10 md:[&:not(:first-child)]:px-10 md:last:pl-10">
                <p className="text-[15px] text-foreground leading-relaxed">"{t.quote}"</p>
                <div className="mt-auto pt-4 border-t border-border/50">
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROVIDER NETWORK */}
      <section className="w-full px-4 py-20 md:py-28 bg-muted/20 border-b border-border/50">
        <div className="container max-w-screen-xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">Provider network</p>
              <h2 className="font-serif text-4xl md:text-5xl font-medium text-foreground leading-tight mb-6">
                50+ providers.<br />Matched by what<br />actually works.
              </h2>
              <p className="text-[15px] text-muted-foreground leading-relaxed mb-8">
                Every Anamnesis provider carries documented outcome data by clinical profile. When we match you to a therapist, it's because they have a verified track record with patients who present like you — not because they ticked the right specialty boxes.
              </p>
              <Link href="/therapists" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline underline-offset-4">
                Browse all providers <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Anxiety & Stress", count: "12 providers" },
                { label: "Depression", count: "11 providers" },
                { label: "Trauma & PTSD", count: "9 providers" },
                { label: "Relationships", count: "8 providers" },
                { label: "Grief & Loss", count: "6 providers" },
                { label: "Burnout", count: "7 providers" },
                { label: "Life Transitions", count: "8 providers" },
                { label: "Identity & Meaning", count: "5 providers" },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-border/50 rounded-md px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ACQUISITION PITCH ROW */}
      <section className="w-full px-4 py-16 border-b border-border/50">
        <div className="container max-w-screen-xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y-2 md:divide-y-0 md:divide-x divide-border/40">
            {[
              { label: "Async intake", body: "Patients complete on their schedule. No clinician time required at intake." },
              { label: "Auto-documentation", body: "SOAP notes generated immediately. Zero administrative lag." },
              { label: "Biometric layer", body: "Physiological context no competing platform captures." },
              { label: "Outcome matching", body: "Provider selection rooted in documented clinical results." },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-2 py-8 md:py-0 md:first:pr-8 md:[&:not(:first-child)]:px-8 md:last:pl-8">
                <h4 className="text-sm font-medium text-foreground">{item.label}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="w-full px-4 py-24 md:py-32">
        <div className="container max-w-screen-xl mx-auto">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">Get started</p>
            <h2 className="font-serif text-4xl md:text-6xl font-medium text-foreground leading-tight mb-6">
              Better care starts<br />with better intake.
            </h2>
            <p className="text-[15px] text-muted-foreground leading-relaxed mb-10 max-w-lg">
              Takes about 20 minutes. No forms, no clipboard. At the end, you'll have a matched provider and a clinical brief ready for your first session.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/intake/new">
                <Button size="lg" className="rounded-md h-12 px-7 text-sm font-medium">
                  Begin your intake <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href="/therapists" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                View providers instead
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
