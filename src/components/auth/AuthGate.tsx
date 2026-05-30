import { useState, useEffect, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

// ── AuthGate ──────────────────────────────────────────────────────────────────

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const setUserId = useStore((s) => s.setUserId);
  const hydrateFromSupabase = useStore((s) => s.hydrateFromSupabase);
  const loadFromCache = useStore((s) => s.loadFromCache);

  useEffect(() => {
    // No Supabase configured — local-only mode, load from cache and skip auth
    if (!supabase) {
      loadFromCache().then(() => setSession(null));
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (sess && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) {
        setUserId(sess.user.id);
        loadFromCache().then(() => hydrateFromSupabase());
      } else if (!sess) {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Local-only mode (no Supabase) — render app directly
  if (!supabase) return <>{children}</>;

  // Checking session
  if (session === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!session) return <LoginForm />;

  // Authenticated
  return <>{children}</>;
}

// ── LoginForm ─────────────────────────────────────────────────────────────────

function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setLoading(true);

    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) setError(err.message);
      else setSignupDone(true);
    }

    setLoading(false);
  };

  const inputCls =
    "w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] " +
    "text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] " +
    "outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-shadow";

  if (signupDone) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[var(--color-background)] px-4">
        <div className="w-full max-w-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]">Check your email</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <button
            onClick={() => { setMode("signin"); setSignupDone(false); }}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[var(--color-background)] px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-3 shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)] tracking-tight">Noteboard</h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
          {mode === "signin" ? "Sign in to your boards" : "Create your account"}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={inputCls}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className={inputCls}
        />

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full h-10 rounded-xl" disabled={loading}>
          {loading
            ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => { setMode((m) => (m === "signin" ? "signup" : "signin")); setError(""); }}
        className="mt-5 text-sm text-[var(--color-primary)] hover:underline"
      >
        {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
