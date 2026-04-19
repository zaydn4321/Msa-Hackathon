import { useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateSession } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

export default function IntakeNew() {
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();

  useEffect(() => {
    createSession.mutate(
      { data: {} },
      {
        onSuccess: (session) => {
          setLocation(`/intake/${session.id}`);
        },
        onError: (err) => {
          console.error("Failed to create session", err);
          // Could show toast here, for now simple fallback
        }
      }
    );
  }, []); // Run once on mount

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
        <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center shadow-sm">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="font-serif text-2xl font-medium text-foreground">Preparing your session</h2>
          <p className="text-muted-foreground">Creating a private, secure space for your intake.</p>
        </div>
      </div>
    </div>
  );
}
