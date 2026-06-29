import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analyticsTracking';

export function usePageTracking() {
  const location = useLocation();
  const lastPath = useRef('');

  useEffect(() => {
    const path = location.pathname || '/';
    if (path === lastPath.current) return;
    lastPath.current = path;
    trackPageView(path);
  }, [location.pathname]);
}
