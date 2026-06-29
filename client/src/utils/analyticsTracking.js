import { publicApiUrl } from '../api/apiBase';

const SESSION_KEY = 'sg_analytics_sid';

export function getAnalyticsSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function postTrack(path, body) {
  const url = publicApiUrl(path);
  const payload = JSON.stringify(body);

  const sendFetch = () => {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      mode: 'cors',
    }).catch(() => {});
  };

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    const ok = navigator.sendBeacon(url, blob);
    if (!ok) sendFetch();
    return;
  }

  sendFetch();
}

export function trackPageView(path, referrer) {
  postTrack('/track/pageview', {
    path,
    referrer: referrer || (typeof document !== 'undefined' ? document.referrer : undefined) || undefined,
    sessionId: getAnalyticsSessionId(),
  });
}

export function trackFormEvent(formId, event, path = typeof window !== 'undefined' ? window.location.pathname : '/') {
  postTrack('/track/form-event', {
    formId,
    event,
    path,
    sessionId: getAnalyticsSessionId(),
  });
}
