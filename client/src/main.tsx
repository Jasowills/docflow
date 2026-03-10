import React from 'react';
import ReactDOM from 'react-dom/client';
import { LogtoProvider, type LogtoConfig } from '@logto/react';
import { AuthProvider } from './auth/auth-context';
import {
  getAuthMode,
  getLogtoApiResource,
  getLogtoAppId,
  getLogtoEndpoint,
} from './config/runtime-config';
import { RealtimeStoreProvider } from './state/realtime-store';
import { ClientDataStoreProvider } from './state/client-data-store';
import App from './App';
import './index.css';

const storedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = storedTheme === 'dark' || storedTheme === 'light'
  ? storedTheme
  : (prefersDark ? 'dark' : 'light');
document.documentElement.classList.toggle('dark', initialTheme === 'dark');

const authMode = getAuthMode();
const logtoConfig: LogtoConfig | null =
  authMode === 'logto' && getLogtoEndpoint() && getLogtoAppId()
    ? {
        endpoint: getLogtoEndpoint(),
        appId: getLogtoAppId(),
        resources: getLogtoApiResource() ? [getLogtoApiResource()!] : undefined,
      }
    : null;

function AppProviders() {
  return (
    <AuthProvider>
      <RealtimeStoreProvider>
        <ClientDataStoreProvider>
          <App />
        </ClientDataStoreProvider>
      </RealtimeStoreProvider>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {logtoConfig ? (
      <LogtoProvider config={logtoConfig}>
        <AppProviders />
      </LogtoProvider>
    ) : (
      <AppProviders />
    )}
  </React.StrictMode>,
);
