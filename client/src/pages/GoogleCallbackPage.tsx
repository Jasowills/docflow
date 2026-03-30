import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";

export function GoogleCallbackPage() {
  const { handleGoogleCallback, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get("code");
    const urlError = searchParams.get("error");

    if (urlError) {
      setError(
        searchParams.get("error_description") ||
          "Google sign-in was cancelled or failed.",
      );
      setIsProcessing(false);
      return;
    }

    if (!code) {
      setError("No authorization code received from Google.");
      setIsProcessing(false);
      return;
    }

    handleGoogleCallback(code)
      .then(() => setIsProcessing(false))
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Authentication failed",
        );
        setIsProcessing(false);
      });
  }, [searchParams, handleGoogleCallback]);

  if (!isProcessing && isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center">
          <div className="w-full rounded-xl border border-border/80 bg-card/95 p-6 text-center shadow-sm backdrop-blur sm:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-primary/80">
              DocFlow
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Sign-in failed
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {error}
            </p>
            <div className="mt-6">
              <Button asChild className="w-full">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 px-4 py-3">
          <Spinner className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Completing sign-in...
          </span>
        </div>
      </div>
    </div>
  );
}
