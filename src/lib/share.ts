/**
 * Handing text to the outside world. Web copies to the clipboard; native opens
 * the share sheet. Returns what happened so callers can confirm it in their own
 * words rather than guessing.
 */
import { Share } from 'react-native';

export type ShareResult = 'copied' | 'shared' | 'unavailable';

export async function shareText(text: string, title: string): Promise<ShareResult> {
  if (process.env.EXPO_OS === 'web') {
    const nav = (
      globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }
    ).navigator;
    if (!nav?.clipboard?.writeText) return 'unavailable';
    try {
      await nav.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'unavailable';
    }
  }
  await Share.share({ message: text, title });
  return 'shared';
}
