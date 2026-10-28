import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '@/lib/appVersion.js';
import {
  describeUpdateAvailability,
  fetchLatestReleaseFeed,
  getReleaseFeedUrl,
} from '@/lib/releaseFeed.js';

const DISMISS_KEY = 'pesagens:dismissed-update-version';

function readDismissedVersion() {
  try {
    return localStorage.getItem(DISMISS_KEY) || '';
  } catch {
    return '';
  }
}

export function dismissUpdateNotice(appVersion) {
  if (!appVersion) return;
  try {
    localStorage.setItem(DISMISS_KEY, String(appVersion));
  } catch {
    /* ignore */
  }
}

/**
 * Verificação opcional de nova versão (requer internet pontual).
 * Não bloqueia o uso offline do sistema.
 */
export function useReleaseUpdateCheck() {
  const feedUrl = getReleaseFeedUrl();
  const [state, setState] = useState({
    loading: Boolean(feedUrl),
    feed: null,
    status: feedUrl ? 'checking' : 'disabled',
    dismissed: false,
  });

  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!feedUrl) {
      setState({ loading: false, feed: null, status: 'disabled', dismissed: false });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, status: 'checking' }));
    const feed = await fetchLatestReleaseFeed(feedUrl);
    if (!mounted.current) return;
    const { status } = describeUpdateAvailability(feed, APP_VERSION);
    const dismissed = status === 'update-available' && readDismissedVersion() === feed?.appVersion;
    setState({ loading: false, feed, status, dismissed });
  }, [feedUrl]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => { mounted.current = false; };
  }, [refresh]);

  const visible = state.status === 'update-available' && state.feed && !state.dismissed;

  const dismiss = useCallback(() => {
    if (state.feed?.appVersion) dismissUpdateNotice(state.feed.appVersion);
    setState((prev) => ({ ...prev, dismissed: true }));
  }, [state.feed?.appVersion]);

  return {
    feedUrl,
    loading: state.loading,
    feed: state.feed,
    status: state.status,
    visible,
    refresh,
    dismiss,
  };
}
