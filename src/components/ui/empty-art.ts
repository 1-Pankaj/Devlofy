/**
 * Empty-state stills — 512px transparent EEVEE renders of the garden prop kit.
 * Author the props in Blender, then re-render via
 * `tools/blender/empty_state_stills.py` (scene restores itself afterwards).
 */
import type { ImageSourcePropType } from 'react-native';

import clients from '@/assets/images/empty/clients.png';
import focus from '@/assets/images/empty/focus.png';
import notes from '@/assets/images/empty/notes.png';
import projects from '@/assets/images/empty/projects.png';
import tasks from '@/assets/images/empty/tasks.png';

/** Metro hands back numbers on native and URL strings on web. */
function still(asset: number | string): ImageSourcePropType {
  return typeof asset === 'string' ? { uri: asset } : asset;
}

export const emptyArt = {
  notes: still(notes),
  clients: still(clients),
  projects: still(projects),
  tasks: still(tasks),
  focus: still(focus),
} as const;
