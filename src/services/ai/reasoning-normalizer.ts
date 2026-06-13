export type NormalizedReasoningOutput = {
  content: string;
  reasoning: string;
};

const CHANNEL_TOKEN_PATTERN = /<\|channel\|>|<\|channel>|<channel\|>/gi;
const FINAL_MARKER_PATTERN = /(?:^|\n)\s*(?:final|final answer|answer|assistant)\s*[:\n-]\s*/i;

type NormalizeOptions = {
  recoverFinalFromUnclosedReasoning?: boolean;
};

export function normalizeReasoningOutput(
  text: string,
  options: NormalizeOptions = {}
): NormalizedReasoningOutput {
  const withoutThink = extractThinkBlocks(text, options);
  const channelSplit = splitChannelOutput(withoutThink.content);
  return {
    content: cleanVisibleText(channelSplit.content),
    reasoning: cleanReasoningText([withoutThink.reasoning, channelSplit.reasoning].join('\n')),
  };
}

function extractThinkBlocks(text: string, options: NormalizeOptions): NormalizedReasoningOutput {
  let content = '';
  const reasoning: string[] = [];
  let cursor = 0;
  const openTag = /<think>/gi;

  while (true) {
    const open = openTag.exec(text);
    if (!open) break;
    content += text.slice(cursor, open.index);
    const reasoningStart = open.index + open[0].length;
    const closeIndex = text.toLowerCase().indexOf('</think>', reasoningStart);
    if (closeIndex === -1) {
      const tail = text.slice(reasoningStart);
      const recovered = options.recoverFinalFromUnclosedReasoning
        ? splitRecoveredFinal(tail)
        : null;
      reasoning.push(recovered?.reasoning ?? tail);
      if (recovered?.content) content += recovered.content;
      cursor = text.length;
      break;
    }
    reasoning.push(text.slice(reasoningStart, closeIndex));
    cursor = closeIndex + '</think>'.length;
    openTag.lastIndex = cursor;
  }

  content += text.slice(cursor);
  return { content, reasoning: reasoning.join('\n') };
}

function splitRecoveredFinal(text: string): NormalizedReasoningOutput | null {
  const match = text.match(FINAL_MARKER_PATTERN);
  if (!match || match.index == null) return null;
  const contentStart = match.index + match[0].length;
  const content = text.slice(contentStart).trim();
  if (!content) return null;
  return {
    reasoning: text.slice(0, match.index).trim(),
    content,
  };
}

function splitChannelOutput(text: string): NormalizedReasoningOutput {
  const matches = Array.from(text.matchAll(CHANNEL_TOKEN_PATTERN));
  if (!matches.length) return { content: text, reasoning: '' };

  let content = '';
  const reasoning: string[] = [];
  let currentChannel: 'visible' | 'reasoning' | 'discard' = 'visible';
  let cursor = 0;

  for (const match of matches) {
    const tokenStart = match.index ?? 0;
    appendChannelText(text.slice(cursor, tokenStart), currentChannel, reasoning, (value) => {
      content += value;
    });

    cursor = tokenStart + match[0].length;
    const labelMatch = text.slice(cursor).match(/^\s*(final|thought|analysis|reasoning)\b[:\s-]*/i);
    if (labelMatch) {
      const label = labelMatch[1].toLowerCase();
      currentChannel = label === 'final' ? 'visible' : 'reasoning';
      cursor += labelMatch[0].length;
    } else {
      currentChannel = 'discard';
    }
  }

  appendChannelText(text.slice(cursor), currentChannel, reasoning, (value) => {
    content += value;
  });

  return { content, reasoning: reasoning.join('\n') };
}

function appendChannelText(
  value: string,
  channel: 'visible' | 'reasoning' | 'discard',
  reasoning: string[],
  appendContent: (value: string) => void
) {
  if (!value) return;
  if (channel === 'visible') {
    appendContent(value);
  } else if (channel === 'reasoning') {
    reasoning.push(value);
  }
}

function cleanVisibleText(text: string) {
  return text
    .replace(CHANNEL_TOKEN_PATTERN, ' ')
    .replace(/<\/?think>/gi, ' ')
    .replace(/^\s*(?:final|thought|analysis|reasoning)\b[:\s-]*/i, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanReasoningText(text: string) {
  return text
    .replace(CHANNEL_TOKEN_PATTERN, ' ')
    .replace(/<\/?think>/gi, ' ')
    .replace(/^\s*(?:thought|analysis|reasoning)\b[:\s-]*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
