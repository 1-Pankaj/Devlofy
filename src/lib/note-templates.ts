/**
 * Note templates — one tap turns an empty note into a working skeleton.
 * Pure data; the editor writes them into the draft like any other text.
 */
import type { ComponentType } from 'react';
import type { IconProps } from 'phosphor-react-native';
import { Bug, Code, Notebook, PhoneCall } from 'phosphor-react-native';

export type NoteTemplate = {
  id: string;
  label: string;
  icon: ComponentType<IconProps>;
  title: string;
  body: string;
};

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'standup',
    label: 'Standup',
    icon: Notebook,
    title: 'Standup notes',
    body: '## Yesterday\n- \n\n## Today\n- \n\n## Blockers\n- none so far\n',
  },
  {
    id: 'bug',
    label: 'Bug log',
    icon: Bug,
    title: 'Bug log',
    body: '## What happens\n\n## Steps to reproduce\n1. \n2. \n\n## Root cause\n\n## Fix\n- [ ] patch\n- [ ] verify\n',
  },
  {
    id: 'call',
    label: 'Call notes',
    icon: PhoneCall,
    title: 'Call notes',
    body: '## Call\n\n**With:** \n\n## Decisions\n- \n\n## Follow-ups\n- [ ] \n',
  },
  {
    id: 'snippet',
    label: 'Snippet',
    icon: Code,
    title: 'Snippet',
    body: '```ts\n\n```\n',
  },
];
