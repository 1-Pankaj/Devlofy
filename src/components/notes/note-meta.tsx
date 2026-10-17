/**
 * NoteMeta — the note's relationships: tags, and the client / project it
 * belongs to. Chips wrap under the title; tags edit inline, links open a
 * compact picker sheet. Pure presentation: every change goes up through
 * callbacks, the editor owns persistence.
 */
import {
  Briefcase,
  Check,
  Plus,
  Tag,
  UsersThree,
  X,
  type IconProps,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { fonts, radius, spacing, useTheme, type ThemeColors } from '@/theme';

export type MetaLink = { id: string; name: string };

export type NoteMetaProps = {
  tags: string[];
  /** Current links — ids plus their resolved display names. */
  clientId: string | null;
  projectId: string | null;
  clientName: string | null;
  projectName: string | null;
  clients: MetaLink[];
  projects: MetaLink[];
  /** Every tag currently in use across notes — tap to reuse. */
  suggestions: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onPickClient: (id: string | null) => void;
  onPickProject: (id: string | null) => void;
};

function chipStyle(colors: ThemeColors) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: spacing.md,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairline,
  };
}

function SheetRow({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon?: ComponentType<IconProps>;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale haptic="selection" accessibilityLabel={`Link ${label}`} onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
        }}>
        {Icon ? <Icon size={16} color={selected ? colors.accent : colors.textTertiary} weight="light" /> : null}
        <AppText variant="subheadMedium" tone={selected ? 'accent' : 'default'} style={{ flex: 1 }}>
          {label}
        </AppText>
        {selected ? <Check size={14} color={colors.accent} weight="bold" /> : null}
      </View>
    </PressableScale>
  );
}

function LinkSheet({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: MetaLink[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close picker"
        style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}
        onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: colors.hairline,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.md,
            }}>
            <AppText variant="headline">{title}</AppText>
            <PressableScale haptic="light" accessibilityLabel="Close" onPress={onClose}>
              <X size={18} color={colors.textTertiary} weight="bold" />
            </PressableScale>
          </View>
          <ScrollView style={{ maxHeight: 380 }}>
            <SheetRow label="Unlinked" selected={selectedId === null} onPress={() => onSelect(null)} />
            {items.map((item) => (
              <SheetRow
                key={item.id}
                label={item.name}
                selected={item.id === selectedId}
                onPress={() => onSelect(item.id)}
              />
            ))}
            {items.length === 0 ? (
              <AppText variant="subhead" tone="tertiary" style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
                Nothing here yet.
              </AppText>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function NoteMeta({
  tags,
  clientId,
  projectId,
  clientName,
  projectName,
  clients,
  projects,
  suggestions,
  onAddTag,
  onRemoveTag,
  onPickClient,
  onPickProject,
}: NoteMetaProps) {
  const { colors } = useTheme();
  const [tagValue, setTagValue] = useState('');
  const [editingTags, setEditingTags] = useState(false);
  const [sheet, setSheet] = useState<'client' | 'project' | null>(null);

  const reusable = suggestions.filter((s) => !tags.includes(s)).slice(0, 6);

  const commitTag = () => {
    if (tagValue.trim()) onAddTag(tagValue);
    setTagValue('');
  };

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
        {tags.map((tag) => (
          <PressableScale
            key={tag}
            haptic="selection"
            accessibilityLabel={`Remove tag ${tag}`}
            onPress={() => onRemoveTag(tag)}>
            <View style={chipStyle(colors)}>
              <AppText variant="captionMedium" tone="accent">
                #{tag}
              </AppText>
              <X size={11} color={colors.textTertiary} weight="bold" />
            </View>
          </PressableScale>
        ))}

        {editingTags ? (
          <View style={[chipStyle(colors), { borderColor: colors.accentBorder }]}>
            <AppText variant="captionMedium" tone="accent">
              #
            </AppText>
            <TextInput
              value={tagValue}
              onChangeText={setTagValue}
              onSubmitEditing={commitTag}
              onBlur={() => {
                commitTag();
                setEditingTags(false);
              }}
              placeholder="tag"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              autoFocus
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="New tag"
              style={{
                minWidth: 64,
                padding: 0,
                color: colors.text,
                fontFamily: fonts.bodyMedium,
                fontSize: 12,
                height: 30,
              }}
            />
            <PressableScale haptic="light" hitSlop={8} accessibilityLabel="Done adding tags" onPress={() => setEditingTags(false)}>
              <Check size={12} color={colors.accent} weight="bold" />
            </PressableScale>
          </View>
        ) : (
          <PressableScale haptic="selection" accessibilityLabel="Add tag" onPress={() => setEditingTags(true)}>
            <View style={[chipStyle(colors), { borderStyle: 'dashed' }]}>
              <Plus size={11} color={colors.textSecondary} weight="bold" />
              <AppText variant="captionMedium" tone="secondary">
                tag
              </AppText>
            </View>
          </PressableScale>
        )}

        <PressableScale
          haptic="selection"
          accessibilityLabel={clientName ? `Linked client ${clientName}. Change link` : 'Link a client'}
          onPress={() => setSheet('client')}>
          <View style={[chipStyle(colors), clientName ? { borderColor: colors.accentBorder } : { borderStyle: 'dashed' }]}>
            <UsersThree size={12} color={clientName ? colors.accent : colors.textSecondary} weight="light" />
            <AppText variant="captionMedium" tone={clientName ? 'accent' : 'secondary'}>
              {clientName ?? 'client'}
            </AppText>
          </View>
        </PressableScale>

        <PressableScale
          haptic="selection"
          accessibilityLabel={projectName ? `Linked project ${projectName}. Change link` : 'Link a project'}
          onPress={() => setSheet('project')}>
          <View style={[chipStyle(colors), projectName ? { borderColor: colors.accentBorder } : { borderStyle: 'dashed' }]}>
            <Briefcase size={12} color={projectName ? colors.accent : colors.textSecondary} weight="light" />
            <AppText variant="captionMedium" tone={projectName ? 'accent' : 'secondary'}>
              {projectName ?? 'project'}
            </AppText>
          </View>
        </PressableScale>
      </View>

      {editingTags && reusable.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Tag size={11} color={colors.textTertiary} weight="light" />
            <AppText variant="caption" tone="tertiary">
              reuse:
            </AppText>
          </View>
          {reusable.map((suggestion) => (
            <PressableScale key={suggestion} haptic="selection" accessibilityLabel={`Reuse tag ${suggestion}`} onPress={() => onAddTag(suggestion)}>
              <AppText variant="captionMedium" tone="secondary">
                #{suggestion}
              </AppText>
            </PressableScale>
          ))}
        </View>
      ) : null}

      <LinkSheet
        visible={sheet === 'client'}
        title="Link to client"
        items={clients}
        selectedId={clientId}
        onSelect={(id) => {
          onPickClient(id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <LinkSheet
        visible={sheet === 'project'}
        title="Link to project"
        items={projects}
        selectedId={projectId}
        onSelect={(id) => {
          onPickProject(id);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}
