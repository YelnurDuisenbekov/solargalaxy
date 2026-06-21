import { useEffect, useState } from 'react';
import { whatsappApi } from '../api';

let cache = null;
let cacheAt = 0;
const TTL = 60_000;

export function useWhatsAppApi() {
  const [state, setState] = useState(cache || { ready: false, configured: false, loading: true });

  useEffect(() => {
    const fresh = cache && Date.now() - cacheAt < TTL;
    if (fresh) {
      setState({ ...cache, loading: false });
      return;
    }

    whatsappApi.status()
      .then((data) => {
        cache = data;
        cacheAt = Date.now();
        setState({ ...data, loading: false });
      })
      .catch(() => setState({ ready: false, configured: false, loading: false }));
  }, []);

  return state;
}

export function invalidateWhatsAppStatus() {
  cache = null;
  cacheAt = 0;
}
