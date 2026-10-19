/**
 * BlockSheet — what a block can become, and what can be done to it.
 *
 * One sheet, three ways in: the gutter marker, the format bar's ⋯, and typing
 * `/` in an empty line (which opens it filtered, the way a slash menu should).
 * The type cards are the same list in every case, so there is exactly one place
 * that knows a block can be a paragraph, a heading, a list, a quote, code or a
 * divider.
 */
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  CodeBlock,
  Copy,
  ListBullets,
  ListNumbers,
  Minus,
  Paragraph,
  Plus,
  Quotes,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextIndent,
  TextOutdent,
  Trash,
  type IconProps,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { View } from 'react-native';

import { BottomSheet, SheetRow, SheetOption } from '@/components/ui/bottom-sheet';
import type { Block, BlockType } from '@/lib/notes/blocks';
import { spacing, useTheme } from '@/theme';

export type BlockTypeOption = {
  key: string;
  label: string;
  icon: ComponentType<IconProps>;
  type: BlockType;
  hashes: number;
  /** Extra words the slash menu matches on. */
  keywords: string;
};

export const BLOCK_TYPES: BlockTypeOption[] = [
  { key: 'text', label: 'Text', icon: Paragraph, type: 'paragraph', hashes: 1, keywords: 'text paragraph p body' },
  { key: 'h1', label: 'Heading 1', icon: TextHOne, type: 'heading', hashes: 1, keywords: 'heading h1 title big' },
  { key: 'h2', label: 'Heading 2', icon: TextHTwo, type: 'heading', hashes: 2, keywords: 'heading h2 subtitle section' },
  { key: 'h3', label: 'Heading 3', icon: TextHThree, type: 'heading', hashes: 3, keywords: 'heading h3 minor' },
  { key: 'bullet', label: 'Bulleted list', icon: ListBullets, type: 'bullet', hashes: 1, keywords: 'bullet list ul dash point' },
  { key: 'numbered', label: 'Numbered list', icon: ListNumbers, type: 'numbered', hashes: 1, keywords: 'number ordered list ol steps' },
  { key: 'task', label: 'To-do', icon: CheckSquare, type: 'task', hashes: 1, keywords: 'task todo checkbox check action' },
  { key: 'quote', label: 'Quote', icon: Quotes, type: 'quote', hashes: 1, keywords: 'quote callout blockquote' },
  { key: 'code', label: 'Code', icon: CodeBlock, type: 'code', hashes: 1, keywords: 'code fence snippet pre mono' },
  { key: 'divider', label: 'Divider', icon: Minus, type: 'divider', hashes: 1, keywords: 'divider rule line break hr' },
];

/** What to call a block in a sheet title. */
export function blockTypeLabel(block: Block | null): string {
  if (!block) return 'Block';
  const match = BLOCK_TYPES.find(
    (option) => option.type === block.type && (option.type !== 'heading' || option.hashes === block.hashes),
  );
  if (match) return match.label;
  if (block.type === 'heading') return `Heading ${block.hashes}`;
  return 'Block';
}

function matches(option: BlockTypeOption, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return option.label.toLowerCase().includes(needle) || option.keywords.includes(needle);
}

export type BlockSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** `types` is the slash menu: only the grid, filtered by what was typed. */
  mode: 'actions' | 'types';
  block: Block | null;
  /** Text typed after `/`, when the sheet was opened by typing. */
  query?: string;
  onTurn: (type: BlockType, hashes: number) => void;
  onInsert: () => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
  onIndent: (delta: number) => void;
  onDelete: () => void;
};

export function BlockSheet({
  visible,
  onClose,
  mode,
  block,
  query = '',
  onTurn,
  onInsert,
  onDuplicate,
  onMove,
  onIndent,
  onDelete,
}: BlockSheetProps) {
  const { colors } = useTheme();

  const options = BLOCK_TYPES.filter((option) => matches(option, query));
  const pairs: BlockTypeOption[][] = [];
  for (let index = 0; index < options.length; index += 2) {
    pairs.push(options.slice(index, index + 2));
  }

  const listBlock = block?.type === 'bullet' || block?.type === 'numbered' || block?.type === 'task' || block?.type === 'quote';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={mode === 'types' ? 'Turn into' : blockTypeLabel(block)}
      note={
        mode === 'types'
          ? options.length === 0
            ? 'Nothing matches that.'
            : 'Pick what this line should be.'
          : 'Turn this block into something else, or move it around.'
      }
      scroll>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
        {pairs.map((pair, index) => (
          <View key={index} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
            {pair.map((option) => (
              <SheetOption
                key={option.key}
                label={option.label}
                icon={option.icon}
                active={block?.type === option.type && (option.type !== 'heading' || block.hashes === option.hashes)}
                onPress={() => onTurn(option.type, option.hashes)}
              />
            ))}
            {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>

      {mode === 'actions' ? (
        <>
          <View style={{ height: 1, backgroundColor: colors.hairline, marginBottom: spacing.xs }} />
          <SheetRow label="Insert below" icon={Plus} detail="An empty block under this one" onPress={onInsert} />
          <SheetRow label="Duplicate" icon={Copy} onPress={onDuplicate} />
          <SheetRow label="Move up" icon={ArrowUp} onPress={() => onMove(-1)} />
          <SheetRow label="Move down" icon={ArrowDown} onPress={() => onMove(1)} />
          {listBlock ? (
            <>
              <SheetRow label="Indent" icon={TextIndent} detail="Nest it one level in" onPress={() => onIndent(1)} />
              <SheetRow label="Outdent" icon={TextOutdent} detail="Lift it one level out" onPress={() => onIndent(-1)} />
            </>
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.hairline, marginVertical: spacing.xs }} />
          <SheetRow label="Delete block" icon={Trash} tone="danger" onPress={onDelete} />
        </>
      ) : null}
    </BottomSheet>
  );
}
