import { useState, useEffect, useCallback, useRef } from 'react';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function useGoogleCalendar() {
  const [isConnected, setIsConnected] = useState(false);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scriptsReady, setScriptsReady] = useState(false);
  const tokenClientRef = useRef(null);
  const clientId = typeof localStorage !== 'undefined' ? localStorage.getItem('cal_google_client_id') : null;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          loadScript('https://accounts.google.com/gsi/client'),
          loadScript('https://apis.google.com/js/api.js'),
        ]);
        await new Promise(resolve => window.gapi.load('client', resolve));
        await window.gapi.client.init({ discoveryDocs: [DISCOVERY] });
        if (!cancelled) setScriptsReady(true);
      } catch (e) {
        if (!cancelled) setError('無法載入 Google API：' + e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const fetchEvents = useCallback(async () => {
    if (!window.gapi?.client?.calendar) return;
    setIsLoading(true);
    setError(null);
    try {
      const now = new Date();
      const minTime = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
      const maxTime = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString();
      const resp = await window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: minTime,
        timeMax: maxTime,
        showDeleted: false,
        singleEvents: true,
        maxResults: 500,
        orderBy: 'startTime',
      });
      const COLOR_MAP = { '1':'blue','2':'green','3':'violet','4':'red','5':'orange','6':'orange','7':'indigo','8':'green','9':'indigo','10':'green','11':'red' };
      const items = resp.result.items || [];
      setGoogleEvents(items.map(item => ({
        id: `gcal_${item.id}`,
        title: item.summary || '(無標題)',
        startAt: item.start?.dateTime || `${item.start?.date}T00:00:00`,
        endAt:   item.end?.dateTime   || `${item.end?.date}T00:00:00`,
        isAllDay: !!item.start?.date,
        description: item.description || '',
        color: COLOR_MAP[item.colorId] || 'blue',
        type: 'work',
        tags: [],
        isPrivate: false,
        reminder: '',
        source: 'google',
        htmlLink: item.htmlLink,
      })));
      setIsConnected(true);
    } catch (e) {
      if (e.status === 401) {
        setIsConnected(false);
        setError('授權已過期，請重新連結 Google Calendar');
      } else {
        setError(e.message || 'Google Calendar 讀取失敗');
      }
    }
    setIsLoading(false);
  }, []);

  const connect = useCallback(() => {
    if (!scriptsReady || !clientId) return;
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { setError(resp.error); return; }
        await fetchEvents();
      },
    });
    tokenClientRef.current = tc;
    tc.requestAccessToken({ prompt: 'consent' });
  }, [scriptsReady, clientId, fetchEvents]);

  const disconnect = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token?.access_token) {
      window.google?.accounts.oauth2.revoke(token.access_token, () => {});
      window.gapi.client.setToken('');
    }
    setIsConnected(false);
    setGoogleEvents([]);
    setError(null);
  }, []);

  const pushToGoogle = useCallback(async (localEvent) => {
    if (!window.gapi?.client?.calendar) throw new Error('Google Calendar 未連線');
    const body = {
      summary: localEvent.title,
      description: localEvent.description || '',
      location: localEvent.location || '',
    };
    if (localEvent.isAllDay) {
      const dateStr = localEvent.startAt.slice(0, 10);
      const endDate = new Date(localEvent.endAt);
      endDate.setDate(endDate.getDate() + 1);
      body.start = { date: dateStr };
      body.end   = { date: endDate.toISOString().slice(0, 10) };
    } else {
      body.start = { dateTime: localEvent.startAt };
      body.end   = { dateTime: localEvent.endAt };
    }
    const resp = await window.gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: body,
    });
    return { googleId: resp.result.id, htmlLink: resp.result.htmlLink };
  }, []);

  const deleteFromGoogle = useCallback(async (googleEventId) => {
    if (!window.gapi?.client?.calendar) return;
    await window.gapi.client.calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });
  }, []);

  return { isConnected, googleEvents, isLoading, error, scriptsReady, clientId, connect, disconnect, pushToGoogle, deleteFromGoogle };
}
