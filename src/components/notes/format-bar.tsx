/**
 * FormatBar — the toolbar that makes markdown typing optional.
 *
 * Docked under the writing area (never floating over it), because the keyboard
 * is what you are already looking at. The marks act on the focused block's
 * selection through the same pure functions the reading view renders with, so a
 * button that says bold makes bold; an already-bold selection unbolds.
 *
 * Two deliberate choices: the row scrolls rather than hiding actions behind a
 * menu (a dev with a tablet has room), and undo/redo plus the block menu stay
 * pinned to the right so they never scroll away. `keyboardShouldPersistTaps` is
 * `always` — a toolbar the first tap dismisses would be worse than none.
 */
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  At,
  CheckSquare,
  Code,
  CodeBlock,
  DotsThree,
  HighlighterCircle,
  Link,
  ListBullets,
  ListNumbers,
  Minus,
  Quotes,
  TextB,
  TextH,
  TextIndent,
  TextItalic,
  TextOutdent,
  TextStrikethrough,
  type IconProps,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { ScrollView, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import type { Block, BlockType } from '@/lib/notes/blocks';
import type { InlineKind } from '@/lib/notes/inline';
import { radius, spacing, useTheme } from '@/theme';

function BarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onPress,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      haptic="selection"
      disabled={disabled}
      accessibilityLabel={label}
      onPress={onPress}>
      <View
        style={{
          minWidth: 40,
          height: 40,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? colors.accentSoft : 'transparent',
          borderWidth: 1,
          borderColor: active ? colors.accentBorder : 'transparent',
          opacity: disabled ? 0.35 : 1,
        }}>
        <Icon
          size={18}
          color={active ? colors.accent : colors.textSecondary}
          weight={active ? 'fill' : 'regular'}
        />
      </View>
    </PressableScale>
  );
}

function Sep() {
  const { colors } = useTheme();
  return <View style={{ width: 1, height: 22, backgroundColor: colors.hairline, marginHorizontal: spacing.xs }} />;
}

export type FormatBarProps = {
  block: Block | null;
  /** Which inline marks are open at the caret. */
  marks: InlineKind[];
  canUndo: boolean;
  canRedo: boolean;
  menuOpen: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onInline: (kind: InlineKind) => void;
  onLink: () => void;
  onMention: () => void;
  /** Heading button cycles 1 → 2 → 3 → off. */
  onHeading: () => void;
  onType: (type: BlockType) => void;
  onIndent: (delta: number) => void;
  onMenu: () => void;
};

export function FormatBar({
  block,
  marks,
  canUndo,
  canRedo,
  menuOpen,
  onUndo,
  onRedo,
  onInline,
  onLink,
  onMention,
  onHeading,
  onType,
  onIndent,
  onMenu,
}: FormatBarProps) {
  const { colors } = useTheme();
  const type = block?.type ?? 'paragraph';
  const has = (kind: InlineKind) => marks.includes(kind);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.hairline,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        gap: spacing.xs,
      }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ alignItems: 'center', gap: 2, paddingRight: spacing.sm }}>
        <BarButton icon={TextB} label="Bold" active={has('bold')} onPress={() => onInline('bold')} />
        <BarButton icon={TextItalic} label="Italic" active={has('italic')} onPress={() => onInline('italic')} />
        <BarButton
          icon={TextStrikethrough}
          label="Strikethrough"
          active={has('strike')}
          onPress={() => onInline('strike')}
        />
        <BarButton icon={Code} label="Inline code" active={has('code')} onPress={() => onInline('code')} />
        <BarButton
          icon={HighlighterCircle}
          label="Highlight"
          active={has('highlight')}
          onPress={() => onInline('highlight')}
        />
        <BarButton icon={Link} label="Link to a web address" onPress={onLink} />
        <BarButton icon={At} label="Link to another note" onPress={onMention} />

        <Sep />

        <BarButton icon={TextH} label="Heading" active={type === 'heading'} onPress={onHeading} />
        <BarButton icon={ListBullets} label="Bulleted list" active={type === 'bullet'} onPress={() => onType('bullet')} />
        <BarButton
          icon={ListNumbers}
          label="Numbered list"
          active={type === 'numbered'}
          onPress={() => onType('numbered')}
        />
        <BarButton icon={CheckSquare} label="To-do" active={type === 'task'} onPress={() => onType('task')} />
        <BarButton icon={Quotes} label="Quote" active={type === 'quote'} onPress={() => onType('quote')} />
        <BarButton icon={CodeBlock} label="Code block" active={type === 'code'} onPress={() => onType('code')} />
        <BarButton icon={Minus} label="Divider" active={type === 'divider'} onPress={() => onType('divider')} />

        <Sep />

        <BarButton icon={TextIndent} label="Indent" disabled={!block} onPress={() => onIndent(1)} />
        <BarButton icon={TextOutdent} label="Outdent" disabled={!block} onPress={() => onIndent(-1)} />
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <BarButton icon={ArrowUUpLeft} label="Undo" disabled={!canUndo} onPress={onUndo} />
        <BarButton icon={ArrowUUpRight} label="Redo" disabled={!canRedo} onPress={onRedo} />
        <BarButton icon={DotsThree} label="Block options" active={menuOpen} onPress={onMenu} />
      </View>
    </View>
  );
}
