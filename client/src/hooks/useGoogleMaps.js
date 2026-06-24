import { useEffect, useState } from 'react';
import { getGoogleMapsApiKey, loadGoogleMaps } from '../utils/googleMapsLoader.js';

export function useGoogleMaps() {
  const [ready, setReady] = useState(!!window.google?.maps);
  const [error, setError] = useState(null);
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    if (!apiKey) {
      setError('no_key');
      return;
    }
    if (window.google?.maps) {
      setReady(true);
      return;
    }
    loadGoogleMaps()
      .then(() => { setReady(true); setError(null); })
      .catch((e) => { setError(e.message); setReady(false); });
  }, [apiKey]);

  return { ready, error, hasKey: !!apiKey };
}
