type LinkedomWindow = {
  document?: unknown;
  Node?: unknown;
  HTMLElement?: unknown;
  DOMParser?: unknown;
};

/**
 * Defuddle expects browser DOM globals while walking linkedom documents.
 * Install them only for the duration of the extraction and always restore
 * the previous runtime globals afterwards.
 */
export async function withDefuddleDomGlobals<T>(
  dom: LinkedomWindow,
  callback: () => Promise<T> | T
): Promise<T> {
  const globalObject = globalThis as Record<string, unknown>;

  const previousDocument = globalObject.document;
  const previousNode = globalObject.Node;
  const previousHTMLElement = globalObject.HTMLElement;
  const previousDOMParser = globalObject.DOMParser;

  try {
    globalObject.document = dom.document;
    globalObject.Node = dom.Node;
    globalObject.HTMLElement = dom.HTMLElement;
    globalObject.DOMParser = dom.DOMParser;

    return await callback();
  } finally {
    globalObject.document = previousDocument;
    globalObject.Node = previousNode;
    globalObject.HTMLElement = previousHTMLElement;
    globalObject.DOMParser = previousDOMParser;
  }
}
