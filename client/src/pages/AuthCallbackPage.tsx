import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useHandleSignInCallback } from '@logto/react';
import { getAuthMode } from '../config/runtime-config';
import { Button } from '../components/ui/button';

export function AuthCallbackPage() {
  if (getAuthMode() !== 'logto') {
    return <Navigate to="/login" replace />;
  }

  return <LogtoAuthCallbackPage />;
}

function LogtoAuthCallbackPage() {
  const { isAuthenticated, isLoading, error } = useHandleSignInCallback();

  useEffect(() => {
    if (error) {
      console.error('Logto callback failed:', error);
    }
  }, [error]);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center">
          <div className="w-full rounded-xl border border-border/80 bg-card/95 p-6 text-center shadow-sm backdrop-blur sm:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-primary/80">DocFlow</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign-in failed</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{error.message}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
        <div className="w-full rounded-xl border border-border/80 bg-card/95 p-6 text-center shadow-sm backdrop-blur sm:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-primary/80">DocFlow</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {isLoading ? 'Completing sign-in...' : 'Signing you in...'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            DocFlow is finalizing your secure session.
          </p>
          <div className="mt-6 flex justify-center">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
