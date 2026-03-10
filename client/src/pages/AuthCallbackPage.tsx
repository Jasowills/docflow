import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useHandleSignInCallback } from '@logto/react';
import { getAuthMode } from '../config/runtime-config';

export function AuthCallbackPage() {
  if (getAuthMode() !== 'logto') {
    return <Navigate to="/login" replace />;
  }

  return <LogtoAuthCallbackPage />;
}

function LogtoAuthCallbackPage() {
  const [handled, setHandled] = useState(false);
  const { isAuthenticated, isLoading, error } = useHandleSignInCallback(() => {
    setHandled(true);
  });

  useEffect(() => {
    if (isAuthenticated) {
      setHandled(true);
    }
  }, [isAuthenticated]);

  if (isAuthenticated || handled) {
    return <Navigate to="/app" replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold">Sign-in failed</h1>
          <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">
          {isLoading ? 'Completing sign-in...' : 'Signing you in...'}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          DocFlow is finalizing your secure session.
        </p>
      </div>
    </div>
  );
}
