import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useCreateSession } from "@workspace/api-client-react";
import { Loader2, CheckCircle2, Shield, Lock, Zap } from "lucide-react";

export default function IntakeNew() {
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();
  
  const [step1, setStep1] = useState<"pending" | "loading" | "done">("loading");
  const [step2, setStep2] = useState<"pending" | "loading" | "done">("pending");
  const [step3, setStep3] = useState<"pending" | "loading" | "done">("pending");

  useEffect(() => {
    // Artificial delays to show the loading states as per screenshot
    const t1 = setTimeout(() => {
      setStep1("done");
      setStep2("loading");
    }, 1500);
    
    const t2 = setTimeout(() => {
      setStep2("done");
      setStep3("loading");
      
      // Actually trigger the API call here
      createSession.mutate(
        { data: {} },
        {
          onSuccess: (session) => {
            setStep3("done");
            setTimeout(() => {
              setLocation(`/intake/${session.id}`);
            }, 500);
          },
          onError: (err) => {
            console.error("Failed to create session", err);
            // On error we still redirect so user can see error state there or we handle it
            setStep3("done");
            setTimeout(() => {
              setLocation(`/patient-portal`);
            }, 1000);
          }
        }
      );
    }, 3000);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[100dvh] bg-[#F5EFE6] p-6">
      <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-sm border border-[#E8E1D7] p-10 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
        
        <div className="h-20 w-20 rounded-full border-[4px] border-[#F5EFE6] overflow-hidden mb-6 bg-muted">
          <img 
            src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=200&h=200" 
            alt="AI Avatar" 
            className="w-full h-full object-cover"
          />
        </div>
        
        <h2 className="font-serif text-3xl font-medium text-[#2D2626] mb-8">Preparing Session</h2>
        
        <div className="w-full space-y-5 text-left mb-10">
          <div className="flex items-center gap-4">
            <div className="w-6 flex justify-center shrink-0">
              {step1 === "done" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : step1 === "loading" ? <Loader2 className="h-5 w-5 text-[#9B7250] animate-spin" /> : <div className="h-5 w-5 rounded-full border-2 border-[#E8E1D7]" />}
            </div>
            <span className={`text-[15px] font-medium ${step1 === "done" ? "text-[#2D2626]" : step1 === "loading" ? "text-[#2D2626]" : "text-[#A09890]"}`}>
              Securing session parameters
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-6 flex justify-center shrink-0">
              {step2 === "done" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : step2 === "loading" ? <Loader2 className="h-5 w-5 text-[#9B7250] animate-spin" /> : <div className="h-5 w-5 rounded-full border-2 border-[#E8E1D7]" />}
            </div>
            <span className={`text-[15px] font-medium ${step2 === "done" ? "text-[#2D2626]" : step2 === "loading" ? "text-[#2D2626]" : "text-[#A09890]"}`}>
              Calibrating biometric sensors
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-6 flex justify-center shrink-0">
              {step3 === "done" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : step3 === "loading" ? <Loader2 className="h-5 w-5 text-[#9B7250] animate-spin" /> : <div className="h-5 w-5 rounded-full border-2 border-[#E8E1D7]" />}
            </div>
            <span className={`text-[15px] font-medium ${step3 === "done" ? "text-[#2D2626]" : step3 === "loading" ? "text-[#2D2626]" : "text-[#A09890]"}`}>
              Preparing clinical question set
            </span>
          </div>
        </div>

        <div className="w-full border-t border-[#E8E1D7] pt-6 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-4 text-[#5C544F]">
            <Shield className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-mono uppercase tracking-wider font-medium">100% Private & HIPAA Compliant</span>
          </div>
          
          <p className="text-[13px] text-[#5C544F] italic mb-6">
            Estimated time: ~2 minutes
          </p>
          
          <button 
            onClick={() => setLocation('/patient-portal')}
            className="text-sm font-medium text-[#A09890] hover:text-[#5C544F] transition-colors"
          >
            Cancel & Return to Portal
          </button>
        </div>

      </div>
    </div>
  );
}
