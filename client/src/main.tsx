import ReactDOM from 'react-dom/client';
import { AuthProvider } from './auth/auth-context';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <RealtimeStoreProvider>
      <ClientDataStoreProvider>
        <App />
      </ClientDataStoreProvider>
    </RealtimeStoreProvider>
  </AuthProvider>,
);
