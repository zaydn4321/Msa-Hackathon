import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useClerk, useAuth, useSignIn } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Copy, Check, LogIn, UserRound, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type DemoAccount = {
  role: "patient" | "therapist";
  recordId: number;
  name: string;
  email: string;
  headline: string;
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        const ok = await copy(value);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#E8E1D7] bg-white px-2.5 py-1 text-xs font-medium text-[#5C544F] hover:border-[#D5CFC6] hover:bg-[#F8F6F1] transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-[#9B7250]" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  );
}

export default function DemoPage() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { toast } = useToast();
  const [signingIn, setSigningIn] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ accounts: DemoAccount[] }>({
    queryKey: ["demo/accounts"],
    queryFn: async () => {
      const res = await fetch("/api/demo/accounts");
      if (!res.ok) throw new Error("Failed to load demo accounts");
      return res.json();
    },
    staleTime: 60_000,
  });

  const { patients, therapists } = useMemo(() => {
    const list = data?.accounts ?? [];
    return {
      patients: list.filter((a) => a.role === "patient"),
      therapists: list.filter((a) => a.role === "therapist"),
    };
  }, [data]);

  async function signInAs(email: string) {
    setSigningIn(email);
    try {
      if (isSignedIn) {
        await signOut();
      }

      const tokenRes = await fetch("/api/demo/sign-in-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not get sign-in token");
      }
      const { token } = (await tokenRes.json()) as { token: string };

      const ticketRes = await signIn.ticket({ ticket: token });
      if (ticketRes.error) {
        throw ticketRes.error;
      }

      const finalRes = await signIn.finalize();
      if (finalRes.error) {
        throw finalRes.error;
      }

      toast({
        title: "Signed in",
        description: email,
      });
      setLocation("/portal");
    } catch (err) {
      const e = err as { errors?: Array<{ message?: string; longMessage?: string }>; message?: string };
      toast({
        variant: "destructive",
        title: "Sign-in failed",
        description:
          e.errors?.[0]?.longMessage ??
          e.errors?.[0]?.message ??
          e.message ??
          "Please try again.",
      });
    } finally {
      setSigningIn(null);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F5EFE6]">
      <header className="border-b border-[#E8E1D7] bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5"
          >
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <span className="font-serif italic text-lg text-primary-foreground leading-none -mt-0.5">
                A
              </span>
            </div>
            <span className="font-serif text-2xl font-medium tracking-tight text-foreground">
              Anamnesis
            </span>
          </button>
          <div className="text-xs font-mono uppercase tracking-wider text-[#5C544F]">
            Demo Directory
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <h1 className="font-serif text-4xl md:text-5xl font-medium text-[#2D2626] mb-3">
            Demo accounts
          </h1>
          <p className="text-[15px] text-[#5C544F] max-w-2xl leading-relaxed">
            Pick any account below to experience the full product as that
            person. Sign-in is one-click — no password required.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-[#5C544F]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load demo accounts. Make sure the API server is running.
          </div>
        )}
        {!isLoading && !error && data?.accounts.length === 0 && (
          <div className="rounded-xl border border-[#E8E1D7] bg-white p-6 text-sm text-[#5C544F]">
            No demo accounts have been provisioned yet. The server may still be
            seeding them, or email+password sign-in may need to be enabled in
            the Auth settings.
          </div>
        )}

        {patients.length > 0 && (
          <Section
            icon={<UserRound className="h-4 w-4" />}
            title="Patients"
            count={patients.length}
            accounts={patients}
            onSignIn={signInAs}
            signingIn={signingIn}
          />
        )}

        {therapists.length > 0 && (
          <Section
            icon={<Stethoscope className="h-4 w-4" />}
            title="Therapists"
            count={therapists.length}
            accounts={therapists}
            onSignIn={signInAs}
            signingIn={signingIn}
          />
        )}
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  accounts,
  onSignIn,
  signingIn,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  accounts: DemoAccount[];
  onSignIn: (email: string) => void;
  signingIn: string | null;
}) {
  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-full bg-[#9B7250]/10 text-[#9B7250] flex items-center justify-center">
          {icon}
        </div>
        <h2 className="font-serif text-2xl font-medium text-[#2D2626]">
          {title}
        </h2>
        <span className="text-xs font-mono text-[#A09890]">{count}</span>
      </div>
      <div className="rounded-2xl border border-[#E8E1D7] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F6F1] border-b border-[#E8E1D7] text-[#5C544F]">
            <tr>
              <th className="text-left font-medium px-5 py-3">Name</th>
              <th className="text-left font-medium px-5 py-3 hidden md:table-cell">
                Profile
              </th>
              <th className="text-left font-medium px-5 py-3">Email</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr
                key={a.email}
                className="border-b border-[#F0EBE2] last:border-0 hover:bg-[#FBF9F5] transition-colors"
              >
                <td className="px-5 py-3 font-medium text-[#2D2626]">
                  {a.name}
                </td>
                <td className="px-5 py-3 text-[#5C544F] hidden md:table-cell">
                  {a.headline}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#5C544F]">
                      {a.email}
                    </span>
                    <CopyButton value={a.email} label="email" />
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    size="sm"
                    onClick={() => onSignIn(a.email)}
                    disabled={signingIn === a.email}
                    className="h-8 rounded-md bg-[#9B7250] hover:bg-[#8B6B5D] text-xs px-3"
                  >
                    {signingIn === a.email ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="h-3.5 w-3.5 mr-1.5" />
                        Sign in
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
