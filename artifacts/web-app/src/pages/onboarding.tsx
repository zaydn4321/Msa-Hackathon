import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Loader2, Stethoscope, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Step = "choose" | "patient-name" | "therapist-code" | "therapist-request";

export default function OnboardingPage() {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSignedIn) {
    setLocation("/sign-in");
    return null;
  }

  async function submitPatient() {
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "patient", name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Registration failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["auth/me"] });
      setLocation("/patient-portal");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitTherapist() {
    if (!accessCode.trim()) {
      setError("Please enter your access code.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "therapist", accessCode: accessCode.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Registration failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["auth/me"] });
      setLocation("/therapist-portal");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {step === "choose" && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5">Getting started</p>
            <h1 className="font-serif text-4xl font-medium text-foreground leading-tight mb-3">
              How are you using Anamnesis?
            </h1>
            <p className="text-sm text-muted-foreground mb-10">
              Choose the path that matches your role. You can't change this later.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={() => setStep("patient-name")}
                className="text-left border border-border/60 rounded-xl p-6 hover:border-primary/40 hover:bg-muted/30 transition-all group"
              >
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-5">
                  <User className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-foreground mb-1">I'm a patient</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Complete an intake session and get matched to a therapist.
                </p>
              </button>
              <button
                onClick={() => setStep("therapist-code")}
                className="text-left border border-border/60 rounded-xl p-6 hover:border-primary/40 hover:bg-muted/30 transition-all group"
              >
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-5">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <h3 className="font-medium text-foreground mb-1">I'm a therapist</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Access your client dashboard using your clinic access code.
                </p>
              </button>
            </div>
          </>
        )}

        {step === "patient-name" && (
          <>
            <button
              onClick={() => { setStep("choose"); setError(null); }}
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground mb-8 transition-colors"
            >
              ← Back
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5">Patient profile</p>
            <h1 className="font-serif text-4xl font-medium text-foreground leading-tight mb-3">
              What's your name?
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              This is how your therapist will know you. Use your legal or preferred name.
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPatient()}
                placeholder="Full name"
                className="h-11 w-full rounded-md border border-border/60 bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={submitPatient}
                disabled={isSubmitting}
                className="rounded-md h-11 text-sm font-medium mt-1"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </div>
          </>
        )}

        {step === "therapist-code" && (
          <>
            <button
              onClick={() => { setStep("choose"); setError(null); }}
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground mb-8 transition-colors"
            >
              ← Back
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5">Therapist access</p>
            <h1 className="font-serif text-4xl font-medium text-foreground leading-tight mb-3">
              Enter your access code
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Your access code was provided by your clinic or the Anamnesis team when your profile was created. It looks like <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">HART-2048</code>.
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && submitTherapist()}
                placeholder="e.g. HART-2048"
                className="h-11 w-full rounded-md border border-border/60 bg-card px-4 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {error && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-destructive">{error}</p>
                  <button
                    type="button"
                    onClick={() => { setStep("therapist-request"); setError(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors text-left"
                  >
                    Don't have a code? Request provider access →
                  </button>
                </div>
              )}
              <Button
                onClick={submitTherapist}
                disabled={isSubmitting}
                className="rounded-md h-11 text-sm font-medium mt-1"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Access my dashboard
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                No code yet?{" "}
                <button
                  type="button"
                  onClick={() => { setStep("therapist-request"); setError(null); }}
                  className="underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  Request provider access
                </button>
              </p>
            </div>
          </>
        )}

        {step === "therapist-request" && (
          <>
            <button
              onClick={() => { setStep("therapist-code"); setError(null); }}
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground mb-8 transition-colors"
            >
              ← Back
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5">Provider access request</p>
            <h1 className="font-serif text-4xl font-medium text-foreground leading-tight mb-3">
              Request access to Anamnesis
            </h1>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Provider accounts are provisioned directly by the Anamnesis clinical team. Your clinic administrator can request an account on your behalf — or reach out to us directly.
            </p>
            <div className="border border-border/60 rounded-xl p-6 flex flex-col gap-5 bg-card">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Option 1 — Contact your clinic</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ask your clinic administrator to submit a provider onboarding request. They'll receive your access code within one business day.
                </p>
              </div>
              <div className="border-t border-border/50" />
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Option 2 — Email us directly</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  Send a request with your name, NPI number, and clinic affiliation to:
                </p>
                <a
                  href="mailto:providers@anamnesis.com?subject=Provider%20Access%20Request"
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline underline-offset-4"
                >
                  providers@anamnesis.com
                </a>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              Already have a code?{" "}
              <button
                type="button"
                onClick={() => { setStep("therapist-code"); setError(null); }}
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Enter it here
              </button>
            </p>
          </>
        )}

      </div>
    </div>
  );
}
