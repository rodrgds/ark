import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { MarkdownText } from '@/components/ui/markdown-text';
import { Text } from '@/components/ui/text';
import { normalizeReasoningOutput } from '@/services/ai/reasoning-normalizer';
import type { AiCitation, AiMessage, AiMessageAttachment, AiProgressEvent } from '@/types/ai';
import { router } from 'expo-router';
import {
  Brain,
  BookOpen,
  ChevronDown,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  NotebookPen,
  Search,
  StopCircle,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Image as RNImage, Pressable, StyleSheet, View } from 'react-native';

const EMPTY_CITATIONS: AiCitation[] = [];
const EMPTY_ACTIVITY_MESSAGES: AiMessage[] = [];

export type TraceAction = {
  summary: string;
  tool?: string;
  active?: boolean;
};

export type ChatListItem = {
  message: AiMessage;
  activityMessages: AiMessage[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function openSource(href: string) {
  if (/^https?:\/\//i.test(href)) {
    router.push({
      pathname: '/content/web-reader',
      params: { url: href },
    });
  } else {
    router.push(href as never);
  }
}

function citationMatchesContent(citation: AiCitation, content: string, index: number) {
  if (content.includes(`[${index + 1}]`)) return true;
  const title = citation.title.trim();
  const section = citation.sectionTitle?.trim();
  return (
    (title && new RegExp(escapeRegExp(title), 'i').test(content)) ||
    (section && new RegExp(escapeRegExp(section), 'i').test(content))
  );
}

export function CitationCard({ citation, index }: { citation: AiCitation; index: number }) {
  const locationParts: string[] = [];
  if (citation.sectionTitle) locationParts.push(citation.sectionTitle);
  if (typeof citation.page === 'number') locationParts.push(`page ${citation.page}`);
  const location = locationParts.join(' - ');
  const actionLabel =
    typeof citation.page === 'number'
      ? `Open page ${citation.page}`
      : citation.sectionTitle
        ? 'Open chapter'
        : 'Open source';

  return (
    <View className="gap-1">
      <Text variant="muted" numberOfLines={2}>
        [{index + 1}] {citation.title}
        {location ? `, ${location}` : ''}
      </Text>
      {citation.targetHref ? (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onPress={() => openSource(citation.targetHref!)}>
          <Icon as={ExternalLink} className="size-4" />
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
}

function SourceMentions({ content, citations }: { content: string; citations: AiCitation[] }) {
  const mentioned = React.useMemo(() => {
    const next: Array<{ citation: AiCitation; index: number }> = [];
    let index = 0;
    for (const citation of citations) {
      if (citationMatchesContent(citation, content, index)) next.push({ citation, index });
      index += 1;
    }
    return next;
  }, [citations, content]);

  if (!mentioned.length) return null;

  return (
    <View className="flex-row flex-wrap gap-1">
      {mentioned.map(({ citation, index }) => (
        <Button
          key={`${citation.sourceId}-${citation.sectionTitle ?? citation.title ?? index}`}
          size="sm"
          variant="outline"
          className="h-7 px-2"
          disabled={!citation.targetHref}
          onPress={() => citation.targetHref && openSource(citation.targetHref)}>
          <Text variant="small">[{index + 1}]</Text>
        </Button>
      ))}
    </View>
  );
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function processSummary({
  actions,
  citations,
  hasReasoning,
  streaming,
}: {
  actions: TraceAction[];
  citations: AiCitation[];
  hasReasoning: boolean;
  streaming: boolean;
}) {
  const latestAction = actions.at(-1)?.summary;
  if (streaming) return latestAction || 'Working...';
  const parts: string[] = [];
  if (actions.length) parts.push(countLabel(actions.length, 'step'));
  if (citations.length) parts.push(countLabel(citations.length, 'source'));
  if (!parts.length && hasReasoning) parts.push('Reasoning saved');
  return parts.join(' · ');
}

function ProcessPanel({
  messageId,
  actions,
  reasoning,
  citations = EMPTY_CITATIONS,
  defaultOpen = false,
  streaming = false,
}: {
  messageId?: string;
  actions?: TraceAction[];
  reasoning?: string;
  citations?: AiCitation[];
  defaultOpen?: boolean;
  streaming?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const visibleActions = actions?.filter((action) => action.summary.trim()) ?? [];
  const hasReasoning = !!reasoning?.trim();
  const hasCitations = citations.length > 0;
  const summary = processSummary({
    actions: visibleActions,
    citations,
    hasReasoning,
    streaming,
  });

  if (!visibleActions.length && !hasReasoning && !hasCitations) return null;

  return (
    <View className="border-border/70 bg-background/40 mt-1 rounded-md border">
      <Button
        variant="ghost"
        className="h-auto min-h-9 justify-between px-3 py-2"
        onPress={() => setOpen((current) => !current)}>
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Icon as={hasCitations ? ExternalLink : Brain} className="text-primary size-4" />
          <Text variant="small" className="text-muted-foreground flex-1" numberOfLines={1}>
            {summary}
          </Text>
          {streaming ? <ActivityIndicator size="small" className="ml-1" /> : null}
        </View>
        <Icon as={ChevronDown} className={open ? 'size-4 rotate-180' : 'size-4'} />
      </Button>
      {open ? (
        <View className="border-border gap-3 border-t px-3 py-3">
          {visibleActions.length ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Icon as={Search} className="text-primary size-4" />
                <Text variant="small" className="text-muted-foreground font-medium">
                  Steps
                </Text>
              </View>
              <View className="gap-1.5 pl-6">
                {visibleActions.map((action) => (
                  <View
                    key={`${action.tool ?? 'action'}-${action.summary}`}
                    className="flex-row items-start gap-2">
                    <View className="bg-primary mt-2 h-1.5 w-1.5 rounded-full" />
                    <Text variant="small" className="text-muted-foreground flex-1 leading-5">
                      {action.summary}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {hasCitations ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Icon as={ExternalLink} className="text-primary size-4" />
                <Text variant="small" className="text-muted-foreground font-medium">
                  Sources ({citations.length})
                </Text>
              </View>
              <View className="gap-3 pl-6">
                {citations.map((citation, index) => (
                  <CitationCard
                    key={
                      messageId
                        ? `${messageId}-${citation.sourceId}-${index}`
                        : `${citation.sourceId}-${index}`
                    }
                    citation={citation}
                    index={index}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {hasReasoning ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Icon as={Brain} className="text-primary size-4" />
                <Text variant="small" className="text-muted-foreground font-medium">
                  Reasoning
                </Text>
              </View>
              <View className="pl-6">
                <Text variant="small" className="text-muted-foreground leading-5" selectable>
                  {reasoning}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function attachmentIconForType(type: AiMessageAttachment['type']) {
  if (type === 'image') return ImageIcon;
  if (type === 'note') return NotebookPen;
  if (type === 'library') return BookOpen;
  return FileText;
}

function MessageAttachments({ attachments }: { attachments?: AiMessageAttachment[] }) {
  if (!attachments?.length) return null;

  return (
    <View className="mt-1 gap-2">
      <Text
        variant="small"
        className="text-primary-foreground/70 font-semibold tracking-normal uppercase">
        Attached context
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {attachments.map((attachment, index) => {
          const AttachmentIcon = attachmentIconForType(attachment.type);
          return (
            <View
              key={`${attachment.type}-${attachment.sourceId ?? attachment.uri ?? index}`}
              style={styles.messageAttachmentChip}>
              {attachment.type === 'image' && attachment.uri ? (
                <RNImage source={{ uri: attachment.uri }} style={styles.messageAttachmentImage} />
              ) : (
                <View style={styles.messageAttachmentIcon}>
                  <Icon as={AttachmentIcon} className="text-primary-foreground size-3.5" />
                </View>
              )}
              <Text
                variant="small"
                numberOfLines={1}
                className="text-primary-foreground max-w-[170px]">
                {attachment.title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ChatMessage({
  message,
  activityMessages = EMPTY_ACTIVITY_MESSAGES,
  onDeleteUserMessage,
  onSpeakAssistant,
  speaking,
  speechStatusLabel,
}: {
  message: AiMessage;
  activityMessages?: AiMessage[];
  onDeleteUserMessage: (message: AiMessage) => void;
  onSpeakAssistant?: (message: AiMessage) => void;
  speaking?: boolean;
  speechStatusLabel?: string;
}) {
  if (message.role === 'tool') {
    return null;
  }

  const assistant = message.role === 'assistant';
  const normalized = assistant ? normalizeReasoningOutput(message.content) : null;
  const displayContent = normalized?.content || message.content;
  const displayReasoning = joinReasoning(message.reasoning ?? '', normalized?.reasoning ?? '');
  const actions = actionsFromToolMessages(activityMessages);
  const messageAttachments = message.metadata?.attachments;
  const citationLinks = Object.fromEntries(
    message.citations
      .map((citation, index) => [index + 1, citation.targetHref] as const)
      .filter((entry): entry is readonly [number, string] => Boolean(entry[1]))
  );

  const bubble = (
    <Card
      className={
        assistant
          ? 'max-w-[92%] gap-2 rounded-lg'
          : 'bg-primary max-w-[92%] gap-2 rounded-lg border-transparent'
      }>
      <View className="flex-row items-center justify-between gap-3">
        <Text
          variant="small"
          className={assistant ? 'text-primary uppercase' : 'text-primary-foreground uppercase'}>
          {assistant ? 'Arky' : 'You'}
        </Text>
        {assistant && onSpeakAssistant ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            accessibilityLabel={speaking ? 'Stop reading response aloud' : 'Read response aloud'}
            onPress={() => onSpeakAssistant(message)}>
            <Icon as={speaking ? VolumeX : Volume2} className="size-4" />
            <Text variant="small">{speaking ? (speechStatusLabel ?? 'Stop') : 'Read aloud'}</Text>
          </Button>
        ) : null}
      </View>
      {assistant ? (
        <>
          <MarkdownText citationLinks={citationLinks} onLinkPress={openSource}>
            {displayContent}
          </MarkdownText>
          <SourceMentions content={displayContent} citations={message.citations} />
        </>
      ) : (
        <>
          <Text selectable className="text-primary-foreground">
            {message.content}
          </Text>
          <MessageAttachments attachments={messageAttachments} />
        </>
      )}
      {assistant ? (
        <ProcessPanel
          messageId={message.id}
          actions={actions}
          reasoning={displayReasoning}
          citations={message.citations}
          defaultOpen={false}
        />
      ) : null}
    </Card>
  );

  return (
    <View className={assistant ? 'items-start' : 'items-end'}>
      {assistant ? (
        bubble
      ) : (
        <Pressable onLongPress={() => onDeleteUserMessage(message)}>{bubble}</Pressable>
      )}
    </View>
  );
}

export function StreamingChatMessage({
  content,
  reasoning,
  progressEvents,
  onStop,
}: {
  content: string;
  reasoning: string;
  progressEvents: AiProgressEvent[];
  onStop: () => void;
}) {
  const actions = progressEvents.map((event) => ({ summary: event.label, active: true }));

  return (
    <View className="px-3 pb-2">
      <Card className="gap-2 rounded-lg px-3 py-2">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" />
            <Text variant="small" className="text-primary uppercase">
              Arky
            </Text>
          </View>
          <Button accessibilityLabel="Stop answer" size="icon" variant="ghost" onPress={onStop}>
            <Icon as={StopCircle} className="size-4" />
          </Button>
        </View>
        <ProcessPanel actions={actions} reasoning={reasoning} streaming />
        {content ? (
          <MarkdownText streaming>{content}</MarkdownText>
        ) : (
          <Text variant="muted">{progressEvents.at(-1)?.label || 'Starting...'}</Text>
        )}
      </Card>
    </View>
  );
}

function joinReasoning(...parts: string[]) {
  const filtered: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) filtered.push(trimmed);
  }
  return filtered.join('\n\n');
}

export function buildChatListItems(messages: AiMessage[]): ChatListItem[] {
  const items: ChatListItem[] = [];
  let pendingActivity: AiMessage[] = [];
  for (const message of messages) {
    if (message.role === 'tool') {
      pendingActivity.push(message);
      continue;
    }
    items.push({
      message,
      activityMessages: message.role === 'assistant' ? pendingActivity : [],
    });
    pendingActivity = [];
  }
  return items;
}

function actionsFromToolMessages(messages: AiMessage[]): TraceAction[] {
  const actions: TraceAction[] = [];
  for (const message of messages) {
    if (message.metadata?.actions?.length) {
      actions.push(...message.metadata.actions);
      continue;
    }
    for (const line of message.content.split('\n')) {
      const summary = line.trim();
      if (summary) actions.push({ summary });
    }
  }
  return actions;
}

const styles = StyleSheet.create({
  messageAttachmentChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.16)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    maxWidth: '100%',
    minHeight: 30,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  messageAttachmentIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.18)',
    borderRadius: 999,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  messageAttachmentImage: {
    backgroundColor: 'rgba(10, 10, 10, 0.18)',
    borderRadius: 10,
    height: 24,
    width: 24,
  },
});
