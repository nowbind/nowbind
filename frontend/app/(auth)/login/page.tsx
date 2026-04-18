"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { API_URL } from "@/lib/constants";
import { useAuth } from "@/lib/hooks/use-auth";
import { Mail, ArrowRight, Loader2, Code } from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LoginContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [devUsername, setDevUsername] = useState("");
  const [devLoginAvailable, setDevLoginAvailable] = useState(false);
  const [error, setError] = useState(
    oauthError ? "Authentication failed. Please try again." : ""
  );

  useEffect(() => {
    api.get<{ enabled: boolean }>("/auth/dev-login/status")
      .then((res: { enabled: boolean }) => setDevLoginAvailable(res.enabled))
      .catch((err: unknown) => {
        const status =
          err && typeof err === "object" && "status" in err
            ? (err as ApiError).status
            : 0;

        // Keep the control visible on transient throttling in local dev.
        if (status === 429) {
          setDevLoginAvailable(true);
          return;
        }

        setDevLoginAvailable(false);
      });
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/explore");
    }
  }, [user, authLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post("/auth/magic-link", { email });
      setSent(true);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "status" in err) {
        const status = (err as ApiError).status;
        const message = (err as ApiError).message || "";
        if (status === 403 || message.toLowerCase().includes("suspended") || message.toLowerCase().includes("banned")) {
          setError("This account has been suspended. Contact support if you believe this is an error.");
        } else {
          setError(message || "Failed to send magic link. Please try again.");
        }
      } else {
        setError("Failed to send magic link. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <Logo size={40} linkTo="/" />
          <h1 className="text-2xl font-bold">Welcome to NowBind</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to start writing
          </p>
        </div>

        {devLoginAvailable && (
          <>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="dev username (e.g. alice)"
                value={devUsername}
                onChange={(e) => setDevUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button
                variant="default"
                className="w-full"
                disabled={devLoading}
                onClick={async () => {
                  const normalizedUsername = devUsername.trim();
                  if (!normalizedUsername) {
                    setError("Enter a username for dev login.");
                    return;
                  }

                  setDevLoading(true);
                  setError("");
                  try {
                    const res = await api.post("/auth/dev-login", { username: normalizedUsername });
                    if (res) {
                      window.location.href = "/explore";
                    }
                  } catch (err: unknown) {
                    if (err && typeof err === "object" && "message" in err) {
                      const message = (err as ApiError).message || "";
                      setError(message || "Dev login failed. Is the backend running?");
                    } else {
                      setError("Dev login failed. Is the backend running?");
                    }
                  } finally {
                    setDevLoading(false);
                  }
                }}
              >
                {devLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Code className="mr-2 h-4 w-4" />
                )}
                Dev Login (no keys needed)
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or use production auth
                </span>
              </div>
            </div>
          </>
        )}

        {sent ? (
          <div className="rounded-lg border p-6 text-center">
            <Mail className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="mb-1 font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <strong>{email}</strong>
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={() => setSent(false)}
            >
              Try a different email
            </Button>
          </div>
        ) : (
          <>
            {/* OAuth buttons */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                asChild
              >
                <a href={`${API_URL}/auth/oauth/google`}>
                  <GoogleIcon className="mr-2 h-4 w-4" />
                  Continue with Google
                </a>
              </Button>

              <Button
                variant="outline"
                className="w-full"
                asChild
              >
                <a href={`${API_URL}/auth/oauth/github`}>
                  <GitHubIcon className="mr-2 h-4 w-4" />
                  Continue with GitHub
                </a>
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Send Magic Link
              </Button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
