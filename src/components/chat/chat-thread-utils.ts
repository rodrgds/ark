import type { ChatInputAttachment } from '@/components/chat/chat-input';
import { AIService } from '@/services/ai/ai.service';
import type { AiAttachment, AiMessageAttachment } from '@/types/ai';
import type { ContentPack } from '@/types/content';
import type { ArkDocument } from '@/types/db';

export const CHAT_THREAD_PAGE_SIZE = 60;
export const ATTACHMENT_CONTEXT_CHARS = 1400;

export async function loadMessagePage(threadId: string, before?: number) {
  const rows = await AIService.listMessages(threadId, {
    limit: CHAT_THREAD_PAGE_SIZE + 1,
    before,
  });
  return {
    messages:
      rows.length > CHAT_THREAD_PAGE_SIZE ? rows.slice(rows.length - CHAT_THREAD_PAGE_SIZE) : rows,
    hasOlder: rows.length > CHAT_THREAD_PAGE_SIZE,
  };
}

export function promptForAttachments(attachments: ChatInputAttachment[]) {
  const labels = attachments.map((attachment) => attachment.title).join(', ');
  return labels ? `Review the attached context: ${labels}.` : 'Review the attached context.';
}

export function messageAttachmentsFromAttachments(
  attachments: AiAttachment[]
): AiMessageAttachment[] {
  return attachments.map((attachment) => {
    if (attachment.type === 'image') {
      return {
        type: attachment.type,
        title: attachment.title,
        uri: attachment.uri,
        mimeType: attachment.mimeType,
      };
    }
    return {
      type: attachment.type,
      title: attachment.title,
      sourceId: attachment.sourceId,
    };
  });
}

export function describeLibraryPack(pack: ContentPack) {
  return [
    `${pack.title} (${pack.category}, ${pack.format.toUpperCase()})`,
    pack.description,
    pack.sourceLabel ? `Source: ${pack.sourceLabel}` : '',
    pack.installed ? 'This item is stored in Ark for offline use.' : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, ATTACHMENT_CONTEXT_CHARS);
}

export function describeDocumentAttachment(document: ArkDocument) {
  const text = document.ocrText || document.extractedText || '';
  return [
    `${document.title}${document.mimeType ? ` (${document.mimeType})` : ''}`,
    text ? text.slice(0, ATTACHMENT_CONTEXT_CHARS) : 'Imported document selected from Ark Library.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function inferImageMimeType(uri: string, reportedMimeType: string | null) {
  if (reportedMimeType?.startsWith('image/')) return reportedMimeType;
  const normalized = uri.split('?')[0]?.toLowerCase() ?? '';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}
