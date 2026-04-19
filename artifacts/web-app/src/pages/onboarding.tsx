import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Loader2, Stethoscope, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";

type Step = "choose" | "patient-name" | "therapist-code" | "therapist-request";

export default function OnboardingPage() {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("choose");
  const [role, setRole] = useState<"patient" | "therapist" | null>(null);
  
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
    <div className="min-h-[100dvh] flex flex-col bg-[#F5EFE6]">
      <div className="w-full p-8 flex justify-center">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <span className="font-serif italic text-lg text-primary-foreground leading-none -mt-0.5">A</span>
          </div>
          <span className="font-serif text-2xl font-medium tracking-tight text-foreground">Anamnesis</span>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-6 pb-24">
        <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-sm border border-[#E8E1D7] overflow-hidden">
          
          {step === "choose" && (
            <div className="p-8 md:p-10">
              <div className="text-center mb-8">
                <h1 className="font-serif text-3xl md:text-[2rem] font-medium text-[#2D2626] mb-3">
                  Choose your path
                </h1>
                <p className="text-[#5C544F] text-[15px]">
                  Select how you will be using Anamnesis today.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <button
                  onClick={() => setRole("patient")}
                  className={`w-full text-left relative rounded-xl border p-5 transition-all ${
                    role === "patient" 
                      ? "border-[#9B7250] bg-[#F5EFE6]/50 shadow-[0_0_0_1px_#9B7250]" 
                      : "border-[#E8E1D7] hover:border-[#D5CFC6] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                      role === "patient" ? "bg-[#9B7250] text-white" : "bg-[#F5EFE6] text-[#5C544F]"
                    }`}>
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[#2D2626] text-[15px] mb-0.5">Patient</h3>
                      <p className="text-sm text-[#5C544F]">Complete an intake and find a provider</p>
                    </div>
                  </div>
                  {role === "patient" && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-5 h-6 w-6 rounded-full bg-[#9B7250] text-white flex items-center justify-center">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setRole("therapist")}
                  className={`w-full text-left relative rounded-xl border p-5 transition-all ${
                    role === "therapist" 
                      ? "border-[#9B7250] bg-[#F5EFE6]/50 shadow-[0_0_0_1px_#9B7250]" 
                      : "border-[#E8E1D7] hover:border-[#D5CFC6] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                      role === "therapist" ? "bg-[#9B7250] text-white" : "bg-[#F5EFE6] text-[#5C544F]"
                    }`}>
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[#2D2626] text-[15px] mb-0.5">Therapist</h3>
                      <p className="text-sm text-[#5C544F]">Manage patients and view clinical briefs</p>
                    </div>
                  </div>
                  {role === "therapist" && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-5 h-6 w-6 rounded-full bg-[#9B7250] text-white flex items-center justify-center">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 rounded-xl text-[15px] border-[#E8E1D7] font-medium"
                  onClick={() => {
                    const clerkOutBtn = document.querySelector('.cl-userButtonTrigger');
                    if (clerkOutBtn) (clerkOutBtn as any).click();
                  }}
                >
                  Back to login
                </Button>
                <Button 
                  className="flex-1 h-12 rounded-xl text-[15px] bg-[#9B7250] hover:bg-[#8B6B5D] font-medium"
                  disabled={!role}
                  onClick={() => {
                    if (role === "patient") setStep("patient-name");
                    if (role === "therapist") setStep("therapist-code");
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "patient-name" && (
            <div className="p-8 md:p-10">
              <button
                onClick={() => { setStep("choose"); setError(null); }}
                className="text-sm text-[#5C544F] hover:text-[#2D2626] mb-8 transition-colors flex items-center gap-1.5 font-medium"
              >
                ← Back
              </button>
              <h1 className="font-serif text-3xl font-medium text-[#2D2626] mb-3">
                What's your name?
              </h1>
              <p className="text-[#5C544F] text-[15px] mb-8">
                This is how your therapist will know you.
              </p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#2D2626] mb-2">Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitPatient()}
                    placeholder="e.g. Jane Doe"
                    className="h-12 w-full rounded-xl border border-[#E8E1D7] bg-white px-4 text-[15px] text-[#2D2626] placeholder:text-[#A09890] focus:outline-none focus:border-[#9B7250] focus:ring-1 focus:ring-[#9B7250]"
                  />
                  {error && <p className="text-sm text-destructive mt-2">{error}</p>}
                </div>
                
                <Button
                  onClick={submitPatient}
                  disabled={isSubmitting || !name.trim()}
                  className="w-full rounded-xl h-12 text-[15px] font-medium bg-[#9B7250] hover:bg-[#8B6B5D]"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Complete Setup
                </Button>
              </div>
            </div>
          )}

          {step === "therapist-code" && (
            <div className="p-8 md:p-10">
              <button
                onClick={() => { setStep("choose"); setError(null); }}
                className="text-sm text-[#5C544F] hover:text-[#2D2626] mb-8 transition-colors flex items-center gap-1.5 font-medium"
              >
                ← Back
              </button>
              <h1 className="font-serif text-3xl font-medium text-[#2D2626] mb-3">
                Enter access code
              </h1>
              <p className="text-[#5C544F] text-[15px] mb-8">
                Your access code was provided by your clinic or the Anamnesis team.
              </p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#2D2626] mb-2">Access Code</label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && submitTherapist()}
                    placeholder="e.g. CLINIC-2024"
                    className="h-12 w-full rounded-xl border border-[#E8E1D7] bg-white px-4 text-[15px] font-mono text-[#2D2626] placeholder:text-[#A09890] focus:outline-none focus:border-[#9B7250] focus:ring-1 focus:ring-[#9B7250]"
                  />
                  {error && <p className="text-sm text-destructive mt-2">{error}</p>}
                </div>
                
                <Button
                  onClick={submitTherapist}
                  disabled={isSubmitting || !accessCode.trim()}
                  className="w-full rounded-xl h-12 text-[15px] font-medium bg-[#9B7250] hover:bg-[#8B6B5D]"
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Verify Access
                </Button>
                
                <div className="text-center pt-2">
                  <button
                    onClick={() => { setStep("therapist-request"); setError(null); }}
                    className="text-sm text-[#5C544F] hover:text-[#2D2626] underline underline-offset-4"
                  >
                    Don't have a code?
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "therapist-request" && (
            <div className="p-8 md:p-10">
              <button
                onClick={() => { setStep("therapist-code"); setError(null); }}
                className="text-sm text-[#5C544F] hover:text-[#2D2626] mb-8 transition-colors flex items-center gap-1.5 font-medium"
              >
                ← Back
              </button>
              <h1 className="font-serif text-3xl font-medium text-[#2D2626] mb-3">
                Request provider access
              </h1>
              <p className="text-[#5C544F] text-[15px] mb-8 leading-relaxed">
                Provider accounts are provisioned directly by the Anamnesis clinical team. To request an account:
              </p>
              
              <div className="bg-[#F8F9FA] rounded-xl border border-[#E8E1D7] p-6 mb-8">
                <p className="text-[#2D2626] text-sm leading-relaxed">
                  Send an email to <a href="mailto:providers@anamnesis.com" className="font-medium text-[#9B7250] hover:underline">providers@anamnesis.com</a> with your NPI number and clinic affiliation.
                </p>
              </div>
              
              <Button
                onClick={() => { setStep("therapist-code"); setError(null); }}
                variant="outline"
                className="w-full rounded-xl h-12 text-[15px] border-[#E8E1D7] font-medium"
              >
                I have my code
              </Button>
            </div>
          )}
          
          <div className="border-t border-[#E8E1D7] bg-[#F8F9FA] p-5 text-center">
            <p className="text-xs text-[#5C544F]">
              Need help deciding? <a href="#" className="underline underline-offset-2">Contact Support</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
