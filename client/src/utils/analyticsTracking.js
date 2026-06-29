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

function sendBeacon(path, body) {
  const payload = JSON.stringify(body);
  const url = `/api/public${path}`;
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
    return;
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function trackPageView(path, referrer) {
  sendBeacon('/track/pageview', {
    path,
    referrer: referrer || document.referrer || undefined,
    sessionId: getAnalyticsSessionId(),
  });
}

export function trackFormEvent(formId, event, path = window.location.pathname) {
  sendBeacon('/track/form-event', {
    formId,
    event,
    path,
    sessionId: getAnalyticsSessionId(),
  });
}
