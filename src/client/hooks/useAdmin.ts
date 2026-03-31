import { useState, useEffect } from 'react';
import { useSession } from '../lib/auth-client';

export function useAdmin() {
  const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetch('/api/me')
        .then((r) => r.json())
        .then((d: { isAdmin: boolean }) => setIsAdmin(d.isAdmin))
        .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, [session]);

  return { session, isAdmin };
}
