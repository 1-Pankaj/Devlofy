/**
 * BlockEditor — the writing surface.
 *
 * Every line is a block with its syntax taken off and replaced by chrome: a
 * checkbox for a task, a dot for a bullet, a number for a list, a bar for a
 * quote, a box for code. What you type is what a markdown file would hold, but
 * what you read while writing is not a wall of punctuation.
 *
 * The one trade it makes, honestly: a `TextInput` cannot draw formatted runs, so
 * the block you are *editing* shows its inline markdown and every other block is
 * drawn rich. Tap out and `**bold**` becomes bold. A rich-text engine would fix
 * that and is not something this app is going to hand-roll.
 *
 * Enter ends a block, Backspace at the start folds one up, `# ` / `- ` / `[] `
 * / `> ` / `---` convert as you type, and `/` opens the type menu — the same
 * operations the toolbar uses, all from `blocks.ts`, all pure and checked.
 */
import { Check } from 'phosphor-react-native';
import type { ComponentRef, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, TextInput, View, type TextStyle, type ViewStyle } from 'react-native';

import { BlockSheet } from '@/components/notes/block-sheet';
import { FormatBar } from '@/components/notes/format-bar';
import { RichText } from '@/components/notes/rich-text';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import {
  commitBlockText,
  duplicateBlock,
  indentBlock,
  insertBlock,
  mergeWithPrevious,
  moveBlock,
  parseBlocks,
  removeBlock,
  setBlockText,
  setBlockType,
  toggleTask,
  type Block,
  type BlockType,
  type Focus,
} from '@/lib/notes/blocks';
import { INLINE_MARKERS, activeMarks, applyLink, toggleInline, type InlineKind } from '@/lib/notes/inline';
import { fonts, radius, spacing, useTheme, type ThemeColors } from '@/theme';

type Pending = { index: number; start: number; end: number };
type SheetState = { index: number; mode: 'actions' | 'types'; query: string };

export type BlockEditorProps = {
  body: string;
  onChange: (next: Focus) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  resolveRef: (target: string) => string | null;
  onOpenRef: (target: string) => void;
  onStartRef: (target: string) => void;
  /** Ask the screen for a note title, then insert it as a `[[link]]`. */
  onMention: (apply: (title: string) => void) => void;
  /** Ask the screen for a URL, then wrap the selection in it. */
  onLink: (apply: (href: string) => void) => void;
  /** Focus a block from outside (a template, the outline). */
  focusRequest: { index: number; nonce: number } | null;
  /** Drawn under the last block — templates on an empty note. */
  footer?: ReactNode;
};

/** The type is the layout: a heading is big, a fence is machine text. */
type BlockTextStyle = TextStyle & { fontSize: number; lineHeight: number };

/**
 * The slice of a key event the editor needs. React Native's synthetic event and
 * the browser's own `KeyboardEvent` both fit: the first for `nativeEvent.key`,
 * the second because a Backspace the editor has already handled must not also
 * delete a character itself.
 */
type KeyPressEvent = { nativeEvent: { key: string }; preventDefault?: () => void };

function blockTextStyle(block: Block): BlockTextStyle {
  if (block.type === 'heading') {
    if (block.hashes <= 1) {
      return { fontFamily: fonts.bodyBold, fontSize: 25, lineHeight: 32, letterSpacing: -0.4 };
    }
    if (block.hashes === 2) {
      return { fontFamily: fonts.bodySemibold, fontSize: 21, lineHeight: 28, letterSpacing: -0.3 };
    }
    return { fontFamily: fonts.bodySemibold, fontSize: 18, lineHeight: 26, letterSpacing: -0.2 };
  }
  if (block.type === 'code') {
    return { fontFamily: fonts.monoRegular, fontSize: 14, lineHeight: 21 };
  }
  return { fontFamily: fonts.bodyRegular, fontSize: 16, lineHeight: 26 };
}

function checkboxStyle(checked: boolean, colors: ThemeColors): ViewStyle {
  return {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: checked ? colors.accent : colors.hairlineStrong,
    backgroundColor: checked ? colors.accent : 'transparent',
  };
}

export function BlockEditor({
  body,
  onChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  resolveRef,
  onOpenRef,
  onStartRef,
  onMention,
  onLink,
  focusRequest,
  footer,
}: BlockEditorProps) {
  const { colors } = useTheme();
  const blocks = useMemo(() => parseBlocks(body), [body]);

  const [editing, setEditing] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [pending, setPending] = useState<Pending | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [heights, setHeights] = useState<Record<number, number>>({});

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const rowY = useRef<Record<number, number>>({});

  // A pending caret is applied for one beat and then released, so the platform
  // owns the caret again while the user types.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(null), 80);
    return () => clearTimeout(timer);
  }, [pending]);

  // A pending caret also means the editor still owns the block. On web a toolbar
  // press puts DOM focus on the button (right for a keyboard user, wrong for the
  // caret) and the block is left blurred, so typing after Bold would go nowhere.
  // The platform has already applied the selection by the time this runs.
  useEffect(() => {
    if (!pending) return;
    inputRef.current?.focus();
  }, [pending]);

  // The focused block is always brought into view — after a tap, after Enter,
  // after the outline jumps. Keyed on the index, so typing does not re-scroll.
  useEffect(() => {
    if (editing === null) return;
    const timer = setTimeout(() => {
      const y = rowY.current[editing];
      if (y === undefined) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [editing]);

  // The screen can ask for a block (a template landed, the outline jumped). This
  // is the "adjust state when props change" pattern, not an effect: the request
  // arrives as a new nonce and is consumed in the render that sees it.
  const [seenFocus, setSeenFocus] = useState<number | null>(null);
  if (focusRequest && focusRequest.nonce !== seenFocus) {
    setSeenFocus(focusRequest.nonce);
    setEditing(focusRequest.index);
    setActive(focusRequest.index);
    setPending({ index: focusRequest.index, start: 0, end: 0 });
  }

  const emit = useCallback(
    (next: Focus, caret?: number) => {
      onChange(next);
      setActive(next.focus);
      setEditing(next.focus);
      setPending(caret === undefined ? null : { index: next.focus, start: caret, end: caret });
    },
    [onChange],
  );

  const emitSelection = useCallback(
    (next: Focus, start: number, end: number) => {
      onChange(next);
      setActive(next.focus);
      setEditing(next.focus);
      setPending({ index: next.focus, start, end });
    },
    [onChange],
  );

  const focusBlock = useCallback(
    (index: number) => {
      const block = blocks[index];
      const at = block ? block.text.length : 0;
      setActive(index);
      setEditing(index);
      setSelection({ start: at, end: at });
      setPending({ index, start: at, end: at });
    },
    [blocks],
  );

  const commit = useCallback(
    (index: number, value: string) => {
      const block = blocks[index];
      if (!block) return;
      const slash = block.type === 'paragraph' && value.startsWith('/') && value.length <= 18;
      if (slash) setSheet({ index, mode: 'types', query: value.slice(1) });
      else if (sheet?.mode === 'types' && sheet.index === index) setSheet(null);
      const next = commitBlockText(body, index, value);
      emit(next, next.caret);
    },
    [blocks, body, emit, sheet],
  );

  const backspaceAtStart = useCallback(
    (index: number, event: KeyPressEvent) => {
      if (event.nativeEvent.key !== 'Backspace') return;
      if (selection.start !== 0 || selection.end !== 0) return;
      if (index === 0) return;
      const next = mergeWithPrevious(body, index);
      // On web the keydown's own Backspace would fire after this and eat the
      // character the merge has just put under the caret. (Native never reaches
      // here: the platform's Backspace at position 0 deletes nothing.)
      event.preventDefault?.();
      // The caret belongs where the two texts met, not at the head of the join.
      emit(next, next.caret);
    },
    [body, emit, selection],
  );

  const applyInline = useCallback(
    (kind: InlineKind) => {
      if (active === null) return;
      const block = blocks[active];
      const marker = INLINE_MARKERS[kind];
      if (!block || !marker) return;
      const edit = toggleInline(block.text, selection, marker);
      emitSelection({ body: setBlockText(body, active, edit.text), focus: active }, edit.start, edit.end);
    },
    [active, blocks, body, emitSelection, selection],
  );

  const insertIntoActive = useCallback(
    (inserted: string) => {
      if (active === null) return;
      const block = blocks[active];
      if (!block) return;
      const text = block.text;
      const start = Math.min(selection.start, text.length);
      const end = Math.min(selection.end, text.length);
      const next = `${text.slice(0, start)}${inserted}${text.slice(end)}`;
      const caret = start + inserted.length;
      emitSelection({ body: setBlockText(body, active, next), focus: active }, caret, caret);
    },
    [active, blocks, body, emitSelection, selection],
  );

  /** A web link wraps the selection (or re-points an existing link). */
  const applyHref = useCallback(
    (href: string) => {
      if (active === null) return;
      const block = blocks[active];
      if (!block) return;
      const edit = applyLink(block.text, selection, href);
      if (edit.text === block.text) return;
      emitSelection({ body: setBlockText(body, active, edit.text), focus: active }, edit.start, edit.end);
    },
    [active, blocks, body, emitSelection, selection],
  );

  const applyType = useCallback(
    (type: BlockType, hashes = 1) => {
      const target = sheet?.index ?? active;
      if (target === null) return;
      const base = sheet?.mode === 'types' ? setBlockText(body, target, '') : body;
      setSheet(null);
      emit(setBlockType(base, target, type, hashes), 0);
    },
    [active, body, emit, sheet],
  );

  const cycleHeading = useCallback(() => {
    const target = active;
    if (target === null) return;
    const block = blocks[target];
    if (!block) return;
    if (block.type !== 'heading') applyType('heading', 1);
    else if (block.hashes >= 3) applyType('paragraph');
    else applyType('heading', block.hashes + 1);
  }, [active, applyType, blocks]);

  const sheetIndex = sheet?.index ?? active;

  const handleInsert = useCallback(() => {
    if (sheetIndex === null) return;
    setSheet(null);
    emit(insertBlock(body, sheetIndex), 0);
  }, [body, emit, sheetIndex]);

  const handleDuplicate = useCallback(() => {
    if (sheetIndex === null) return;
    setSheet(null);
    emit(duplicateBlock(body, sheetIndex), 0);
  }, [body, emit, sheetIndex]);

  const handleMove = useCallback(
    (delta: number) => {
      if (sheetIndex === null) return;
      setSheet(null);
      emit(moveBlock(body, sheetIndex, delta), 0);
    },
    [body, emit, sheetIndex],
  );

  const handleIndent = useCallback(
    (delta: number) => {
      const index = sheetIndex;
      if (index === null) return;
      setSheet(null);
      emit(indentBlock(body, index, delta), 0);
    },
    [body, emit, sheetIndex],
  );

  const handleSheetDelete = useCallback(() => {
    if (sheetIndex === null) return;
    setSheet(null);
    emit(removeBlock(body, sheetIndex), 0);
  }, [body, emit, sheetIndex]);

  const activeBlock = active !== null ? blocks[active] ?? null : null;
  const marks = useMemo(
    () => (activeBlock ? activeMarks(activeBlock.text, selection) : []),
    [activeBlock, selection],
  );

  const emptyNote = blocks.length === 1 && blocks[0].text === '' && blocks[0].type === 'paragraph';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {blocks.map((block, index) => {
          const textStyle = blockTextStyle(block);
          const isEditing = editing === index;
          const isQuote = block.type === 'quote';

          const content = isEditing ? (
            <TextInput
              key={`input-${index}`}
              ref={inputRef}
              value={block.text}
              onChangeText={(value) => commit(index, value)}
              onKeyPress={(event) => backspaceAtStart(index, event)}
              onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
              selection={pending && pending.index === index ? { start: pending.start, end: pending.end } : undefined}
              onContentSizeChange={(event) => {
                const height = event.nativeEvent.contentSize.height;
                setHeights((prev) => (prev[index] === height ? prev : { ...prev, [index]: height }));
              }}
              multiline
              autoFocus
              scrollEnabled={false}
              // A DOM `<textarea>` is two rows tall until told otherwise, and the
              // browser's own floor would make every one-line block twice the
              // height it is on a phone. (Native has no such floor.)
              rows={Platform.OS === 'web' ? 1 : undefined}
              textAlignVertical="top"
              autoCapitalize="sentences"
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              accessibilityLabel={`Editing block ${index + 1}`}
              style={[
                textStyle,
                {
                  padding: 0,
                  margin: 0,
                  color: colors.text,
                  minHeight: textStyle.lineHeight + 2,
                  height: heights[index] ? Math.max(textStyle.lineHeight + 2, heights[index]) : undefined,
                },
              ]}
            />
          ) : (
            <PressableScale
              haptic="none"
              accessibilityLabel={`Edit block ${index + 1}`}
              onPress={() => focusBlock(index)}
              contentStyle={{ minHeight: textStyle.lineHeight + 2, justifyContent: 'center' }}>
              {block.type === 'divider' ? (
                <View style={{ height: 1, backgroundColor: colors.hairlineStrong }} />
              ) : emptyNote && index === 0 ? (
                <AppText variant="body" tone="tertiary">
                  Write it down — or type / to choose a block
                </AppText>
              ) : block.text.length === 0 ? (
                <AppText variant="body" tone="tertiary" style={textStyle}>
                  {' '}
                </AppText>
              ) : (
                <RichText
                  text={block.text}
                  style={textStyle}
                  resolveRef={resolveRef}
                  onOpenRef={onOpenRef}
                  onStartRef={onStartRef}
                />
              )}
            </PressableScale>
          );

          const wrapped =
            block.type === 'code' ? (
              <View
                style={{
                  backgroundColor: colors.surfaceSunken,
                  borderRadius: radius.md,
                  borderCurve: 'continuous',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                }}>
                {content}
              </View>
            ) : isQuote ? (
              <View
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: colors.accentBorder,
                  paddingLeft: spacing.md,
                }}>
                {content}
              </View>
            ) : (
              content
            );

          return (
            <View
              key={index}
              onLayout={(event) => {
                rowY.current[index] = event.nativeEvent.layout.y;
              }}
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                paddingVertical: spacing.xs,
                paddingLeft: block.indent * spacing.lg,
              }}>
              <View style={{ width: 24, alignItems: 'flex-end', paddingTop: 3 }}>
                {block.type === 'task' ? (
                  <PressableScale
                    haptic="selection"
                    hitSlop={8}
                    accessibilityLabel={block.checked ? 'Mark as not done' : 'Mark as done'}
                    onPress={() => emit(toggleTask(body, index))}>
                    <View style={checkboxStyle(block.checked, colors)}>
                      {block.checked ? <Check size={12} color={colors.accentContrast} weight="bold" /> : null}
                    </View>
                  </PressableScale>
                ) : block.type === 'bullet' ? (
                  <PressableScale
                    haptic="none"
                    hitSlop={8}
                    accessibilityLabel="Bullet options"
                    onPress={() => setSheet({ index, mode: 'actions', query: '' })}>
                    <AppText variant="body" tone="tertiary" style={{ lineHeight: textStyle.lineHeight }}>
                      •
                    </AppText>
                  </PressableScale>
                ) : block.type === 'numbered' ? (
                  <PressableScale
                    haptic="none"
                    hitSlop={8}
                    accessibilityLabel="List options"
                    onPress={() => setSheet({ index, mode: 'actions', query: '' })}>
                    <AppText variant="mono" tone="tertiary" style={{ lineHeight: textStyle.lineHeight }}>
                      {block.number ?? 1}.
                    </AppText>
                  </PressableScale>
                ) : null}
              </View>

              <View style={{ flex: 1 }}>{wrapped}</View>
            </View>
          );
        })}

        {footer}
      </ScrollView>

      <FormatBar
        block={activeBlock}
        marks={marks}
        canUndo={canUndo}
        canRedo={canRedo}
        menuOpen={sheet !== null && sheet.mode === 'actions'}
        onUndo={onUndo}
        onRedo={onRedo}
        onInline={applyInline}
        onLink={() => onLink(applyHref)}
        onMention={() => onMention(insertIntoActive)}
        onHeading={cycleHeading}
        onType={(type) => applyType(type)}
        onIndent={(delta) => {
          if (active === null) return;
          emit(indentBlock(body, active, delta), undefined);
        }}
        onMenu={() => {
          if (active === null) return;
          setSheet({ index: active, mode: 'actions', query: '' });
        }}
      />

      <BlockSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        mode={sheet?.mode ?? 'actions'}
        block={sheet ? blocks[sheet.index] ?? null : null}
        query={sheet?.query ?? ''}
        onTurn={(type, hashes) => applyType(type, hashes)}
        onInsert={handleInsert}
        onDuplicate={handleDuplicate}
        onMove={handleMove}
        onIndent={handleIndent}
        onDelete={handleSheetDelete}
      />
    </View>
  );
}
