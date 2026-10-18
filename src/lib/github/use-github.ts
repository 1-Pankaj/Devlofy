/**
 * useGithub — the dashboard's state, in one place.
 *
 * Three ideas hold this together:
 *
 *  1. **A snapshot is kept, never assumed.** Opening the screen shows the last
 *     good read instantly (older snapshots are refreshed in the background), so
 *     the screen has an answer before the network does.
 *  2. **A failed refresh is not a failed screen.** GitHub being unreachable
 *     keeps the snapshot and adds a sentence — the user loses freshness, not
 *     their dashboard.
 *  3. **A token that does not work is not kept.** Connecting proves the token
 *     against `/user` first; if that fails, nothing is stored.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { failureMessage, loadDashboard, type GithubSnapshot } from './api';
import { clearCachedSnapshot, getCachedSnapshot, setCachedSnapshot } from './cache';
import { startDeviceFlow, pollDeviceFlow } from './device';
import { clearAuth, getAuth, setAuth, type StoredAuth } from './token';

/** Refresh on open only when the snapshot is older than this. */
const STALE_AFTER_MS = 10 * 60 * 1000;

export type GithubState = {
  /** False until the stored token has been read: "not connected" ≠ "don't know yet". */
  ready: boolean;
  auth: StoredAuth | null;
  snapshot: GithubSnapshot | null;
  /** A connect attempt is in flight. */
  connecting: boolean;
  /** A refresh of an existing connection is in flight. */
  refreshing: boolean;
  /** What went wrong with the last refresh, if anything. */
  error: string | null;
};

export type DeviceState = {
  stage: 'idle' | 'starting' | 'waiting' | 'error';
  userCode: string | null;
  verificationUri: string;
  /** Where to send the user to approve — with the code pre-filled when possible. */
  approveUri: string | null;
  expiresAt: number | null;
  message: string | null;
};

const IDLE_DEVICE: DeviceState = {
  stage: 'idle',
  userCode: null,
  verificationUri: '',
  approveUri: null,
  expiresAt: null,
  message: null,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useGithub() {
  const [state, setState] = useState<GithubState>({
    ready: false,
    auth: null,
    snapshot: null,
    connecting: false,
    refreshing: false,
    error: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const [device, setDevice] = useState<DeviceState>(IDLE_DEVICE);
  const stoppedRef = useRef(false);

  /** Take whatever GitHub will give us, keeping the old snapshot if it refuses. */
  const refresh = useCallback(async (explicitToken?: string) => {
    const token = explicitToken ?? stateRef.current.auth?.token;
    if (!token) return;
    setState((prev) => ({ ...prev, refreshing: true, error: null }));
    try {
      const snapshot = await loadDashboard(token);
      await setCachedSnapshot(snapshot);
      setState((prev) => ({ ...prev, snapshot, refreshing: false, error: null }));
    } catch (error) {
      setState((prev) => ({ ...prev, refreshing: false, error: failureMessage(error) }));
    }
  }, []);

  /**
   * Prove a token, keep it, and fill the screen — in that order, so a typo
   * leaves nothing behind. Returns null on success, or the problem to show.
   */
  const connect = useCallback(
    async (rawToken: string, scopes: string[] = []): Promise<string | null> => {
      const token = rawToken.trim();
      if (!token) return 'Paste a token first.';
      setState((prev) => ({ ...prev, connecting: true, error: null }));
      try {
        const snapshot = await loadDashboard(token);
        const auth: StoredAuth = { token, scopes };
        await setAuth(auth);
        await setCachedSnapshot(snapshot);
        setState((prev) => ({
          ...prev,
          connecting: false,
          ready: true,
          auth,
          snapshot,
          error: null,
        }));
        return null;
      } catch (error) {
        const message = failureMessage(error);
        setState((prev) => ({ ...prev, connecting: false, error: message }));
        return message;
      }
    },
    [],
  );

  const disconnect = useCallback(async () => {
    stoppedRef.current = true;
    setDevice(IDLE_DEVICE);
    await clearAuth();
    await clearCachedSnapshot();
    setState({
      ready: true,
      auth: null,
      snapshot: null,
      connecting: false,
      refreshing: false,
      error: null,
    });
  }, []);

  // Read the token once, show the cache, then refresh only if it is stale.
  useEffect(() => {
    let alive = true;
    (async () => {
      const auth = await getAuth();
      const snapshot = auth ? await getCachedSnapshot() : null;
      if (!alive) return;
      setState((prev) => ({ ...prev, ready: true, auth, snapshot }));
      const stale = !snapshot || Date.now() - new Date(snapshot.fetchedAt).getTime() > STALE_AFTER_MS;
      if (auth && stale) void refresh(auth.token);
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  // Stop the device-flow poll if the screen goes away.
  useEffect(() => {
    stoppedRef.current = false;
    return () => {
      stoppedRef.current = true;
    };
  }, []);

  /** Device flow: show a code, then poll until GitHub says yes. Native only. */
  const startDeviceSignIn = useCallback(async () => {
    stoppedRef.current = false;
    setDevice({ ...IDLE_DEVICE, stage: 'starting' });

    try {
      const flow = await startDeviceFlow();
      if (stoppedRef.current) return;
      setDevice({
        stage: 'waiting',
        userCode: flow.userCode,
        verificationUri: flow.verificationUri,
        approveUri: flow.verificationUriComplete ?? flow.verificationUri,
        expiresAt: Date.now() + flow.expiresInSeconds * 1000,
        message: null,
      });

      const deadline = Date.now() + flow.expiresInSeconds * 1000;
      let intervalSeconds = flow.intervalSeconds;

      while (!stoppedRef.current && Date.now() < deadline) {
        await sleep(intervalSeconds * 1000);
        if (stoppedRef.current) return;

        const result = await pollDeviceFlow(flow.deviceCode);
        if (stoppedRef.current) return;

        if (result.status === 'pending') continue;
        if (result.status === 'slow-down') {
          intervalSeconds += 5;
          continue;
        }
        if (result.status === 'granted') {
          const problem = await connect(result.token, result.scopes);
          if (stoppedRef.current) return;
          setDevice(
            problem
              ? { ...IDLE_DEVICE, stage: 'error', message: problem }
              : IDLE_DEVICE,
          );
          return;
        }
        setDevice({
          ...IDLE_DEVICE,
          stage: 'error',
          message:
            result.status === 'denied'
              ? 'The sign-in was denied on GitHub.'
              : result.status === 'expired'
                ? 'That code expired. Start again for a fresh one.'
                : result.message,
        });
        return;
      }

      if (!stoppedRef.current) {
        setDevice({
          ...IDLE_DEVICE,
          stage: 'error',
          message: 'That code expired. Start again for a fresh one.',
        });
      }
    } catch (error) {
      if (stoppedRef.current) return;
      setDevice({
        ...IDLE_DEVICE,
        stage: 'error',
        message: error instanceof Error ? error.message : 'GitHub could not be reached.',
      });
    }
  }, [connect]);

  const cancelDeviceSignIn = useCallback(() => {
    stoppedRef.current = true;
    setDevice(IDLE_DEVICE);
  }, []);

  return { ...state, device, connect, disconnect, refresh, startDeviceSignIn, cancelDeviceSignIn };
}

/**
 * Whether a token is stored — for entry points that only need to say "connected"
 * or "not yet". Deliberately does not touch the network.
 */
export function useGithubConnected(): boolean | null {
  const [connected, setConnected] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getAuth()
        .then((auth) => {
          if (alive) setConnected(auth !== null);
        })
        .catch(() => {
          if (alive) setConnected(false);
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  return connected;
}
