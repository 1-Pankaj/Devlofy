/**
 * The last good snapshot, so the dashboard opens offline.
 *
 * GitHub is the one part of this app that needs the network, so it is the one
 * part that can be *stale*. Rather than pretending otherwise, the app keeps the
 * last successful read with the time it was taken and shows both: a snapshot
 * that is two hours old beats an empty screen, as long as it says so.
 *
 * Everything is validated on the way out of storage — a cache written by an
 * older version of the app must degrade to a number being missing, never to a
 * crash.
 */
import { kv } from '@/lib/storage';
import type { GithubSnapshot } from './api';

const CACHE_KEY = 'devlofy.github.snapshot';

export async function getCachedSnapshot(): Promise<GithubSnapshot | null> {
  const raw = await kv.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GithubSnapshot>;
    if (!parsed?.viewer?.login || typeof parsed.fetchedAt !== 'string') return null;
    return {
      fetchedAt: parsed.fetchedAt,
      viewer: parsed.viewer,
      rate: parsed.rate ?? null,
      repos: parsed.repos ?? [],
      authoredPrs: parsed.authoredPrs ?? [],
      reviewRequests: parsed.reviewRequests ?? [],
      assignedIssues: parsed.assignedIssues ?? [],
      runs: parsed.runs ?? [],
      notes: parsed.notes ?? [],
    };
  } catch {
    return null;
  }
}

export async function setCachedSnapshot(snapshot: GithubSnapshot): Promise<void> {
  await kv.setItem(CACHE_KEY, JSON.stringify(snapshot));
}

export async function clearCachedSnapshot(): Promise<void> {
  await kv.removeItem(CACHE_KEY);
}
