import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Spinner } from "../components/ui/spinner";
import { CheckCircle2, AlertCircle } from "lucide-react";

type VerifyState =
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "expired" }
  | { kind: "invalid" };

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerifyState>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid" });
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setState({ kind: "success" });
        } else if (res.status === 400) {
          const body = await res.json().catch(() => ({}));
          if (body.message?.includes("expir")) {
            setState({ kind: "expired" });
          } else {
            setState({ kind: "invalid" });
          }
        } else {
          setState({ kind: "invalid" });
        }
      })
      .catch(() => {
        setState({ kind: "invalid" });
      });
  }, [token]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 px-4 py-3">
          <Spinner className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            Verifying your email...
          </span>
        </div>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="p-6 text-center sm:p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl tracking-tight">
                Email verified!
              </CardTitle>
              <CardDescription>
                Your email has been successfully verified. Sign in to access your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
              <Link to="/login">
                <Button className="w-full justify-center px-4 py-6" size="lg">
                  Sign in
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (state.kind === "expired") {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
          <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
            <CardHeader className="p-6 text-center sm:p-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
                <AlertCircle className="h-7 w-7 text-amber-500" />
              </div>
              <CardTitle className="text-2xl tracking-tight text-amber-500">
                Link expired
              </CardTitle>
              <CardDescription>
                Your verification link has expired. Please register again with your email address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-6 pt-0 sm:p-8 sm:pt-0">
              <Link to="/login">
                <Button className="w-full">Sign in</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
        <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
          <CardHeader className="p-6 text-center sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="text-2xl tracking-tight text-destructive">
              Invalid link
            </CardTitle>
            <CardDescription>
              This verification link is invalid or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-6 pt-0 sm:p-8 sm:pt-0">
            <Link to="/login">
              <Button className="w-full">Sign in</Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="w-full">
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
