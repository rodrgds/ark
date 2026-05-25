export type NormalizedToolCall = {
  id?: string;
  name: string;
  arguments: unknown;
};

type LlamaToolCallLike = {
  id?: string;
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown> | null;
  };
};

export type NativeCompletionLike = {
  text?: string | null;
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: LlamaToolCallLike[] | null;
};

export type NormalizedAssistantTurn = {
  content: string;
  reasoning?: string;
  toolCalls: NormalizedToolCall[];
  raw?: string;
};

export function normalizeAssistantTurn(result: NativeCompletionLike): NormalizedAssistantTurn {
  const raw = result.text ?? result.content ?? '';
  const content = cleanVisibleContent(result.content || stripHiddenModelOutput(raw));
  const reasoning = cleanReasoningContent(result.reasoning_content ?? extractReasoning(raw));
  return {
    content,
    reasoning: reasoning || undefined,
    toolCalls: normalizeToolCalls(result.tool_calls ?? []),
    raw,
  };
}

export function stripHiddenModelOutput(text: string) {
  let next = text;
  const finalChannel = next.match(/<\|channel\>final\s*([\s\S]*?)(?:<channel\|>|$)/i);
  if (finalChannel?.[1]?.trim()) {
    next = finalChannel[1];
  }

  next = next
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<\|channel\>thought[\s\S]*?(?:<channel\|>|$)/gi, ' ')
    .replace(/<\|tool_call\>[\s\S]*?(?:<tool_call\|>|<\|tool_call_end\|>|$)/gi, ' ')
    .replace(/<\|tool_calls?\|>[\s\S]*?(?:<\|end_tool_calls?\|>|$)/gi, ' ');

  if (/<think>/i.test(next) && !/<\/think>/i.test(next)) {
    next = next.replace(/<think>[\s\S]*$/i, ' ');
  }

  return cleanVisibleContent(next);
}

function cleanVisibleContent(text: string) {
  return text
    .replace(/<\|(?:channel|constrain|message|end|begin_of_text|end_of_text)\|>/gi, ' ')
    .replace(/<\|(?:start_header_id|end_header_id|eot_id)\|>/gi, ' ')
    .replace(/<channel\|>/gi, ' ')
    .replace(/<\/?think>/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractReasoning(text: string) {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch?.[1]) return thinkMatch[1];
  const gemmaThought = text.match(/<\|channel\>thought\s*([\s\S]*?)(?:<channel\|>|$)/i);
  return gemmaThought?.[1] ?? '';
}

function cleanReasoningContent(text: string) {
  return text
    .replace(/<\|(?:channel|constrain|message|end)\|>/gi, ' ')
    .replace(/<channel\|>/gi, ' ')
    .replace(/<\/?think>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToolCalls(calls: LlamaToolCallLike[]): NormalizedToolCall[] {
  return calls.flatMap((call) => {
    const name = call.function?.name?.trim();
    if (!name) return [];
    return [
      {
        id: call.id,
        name,
        arguments: parseToolArguments(call.function?.arguments),
      },
    ];
  });
}

function parseToolArguments(value: string | Record<string, unknown> | null | undefined) {
  if (!value) return {};
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
