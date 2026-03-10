import { useAuth } from './auth-context';

export function useAccessToken() {
  const { getAccessToken } = useAuth();
  return { getAccessToken };
}
