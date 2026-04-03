import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { useApi } from "../hooks/use-api";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Mail, ArrowLeft } from "lucide-react";

export function PendingVerificationPage() {
  const { user } = useAuth();
  const { resendVerification } = useApi();
  const navigate = useNavigate();
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);

  const email = user?.email || sessionStorage.getItem("pendingVerificationEmail");

  useEffect(() => {
    if (!email) {
      navigate("/login", { replace: true });
    }
  }, [email, navigate]);

  const handleResend = useCallback(async () => {
    if (isResending) return;
    setIsResending(true);
    try {
      await resendVerification(email || undefined);
      setResent(true);
    } catch {
      // Silent failure
    } finally {
      setIsResending(false);
    }
  }, [isResending, resendVerification, email]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center">
        <Card className="w-full border-border/80 bg-card/95 backdrop-blur shadow-lg">
          <CardHeader className="p-6 text-center sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary/80">
              DocFlow
            </p>
            <CardTitle className="text-2xl tracking-tight">
              Check your email
            </CardTitle>
            <CardDescription className="mx-auto max-w-md text-sm leading-6">
              We sent a verification link to{" "}
              <strong className="text-foreground">{email}</strong>. Click it to
              activate your account and continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0 sm:p-8 sm:pt-0">
            {resent ? (
              <p className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
                Verification email resent. Check your inbox.
              </p>
            ) : null}
            <Button
              className="w-full"
              onClick={handleResend}
              disabled={isResending}
            >
              <Mail className="mr-2 h-4 w-4" />
              {isResending ? "Sending..." : "Resend verification email"}
            </Button>
            <Link to="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
