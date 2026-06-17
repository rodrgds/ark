import { DOMParser, parseHTML } from 'linkedom';

type LinkedomDom = ReturnType<typeof parseHTML>;
type MutableGlobal = typeof globalThis & Record<string, unknown>;
type MutableDocument = LinkedomDom['document'] & {
  implementation?: {
    createHTMLDocument?: (title?: string) => unknown;
    [key: string]: unknown;
  };
};

const EMPTY_HTML = '<!doctype html><html><head></head><body></body></html>';
let defuddleDomQueue = Promise.resolve();

function createTurndownDocument() {
  let html = '';
  let parsedDocument = new DOMParser().parseFromString(EMPTY_HTML, 'text/html');

  return {
    open() {
      html = '';
    },
    write(value: string) {
      html += value;
    },
    close() {
      parsedDocument = new DOMParser().parseFromString(html || EMPTY_HTML, 'text/html');
    },
    get body() {
      return parsedDocument.body;
    },
    get head() {
      return parsedDocument.head;
    },
    get documentElement() {
      return parsedDocument.documentElement;
    },
    get defaultView() {
      return parsedDocument.defaultView;
    },
    createElement(tagName: string) {
      return (parsedDocument as unknown as Document).createElement(tagName);
    },
    createTextNode(data: string) {
      return parsedDocument.createTextNode(data);
    },
    getElementById(id: string) {
      return parsedDocument.getElementById(id);
    },
    querySelector(selector: string) {
      return parsedDocument.querySelector(selector);
    },
    querySelectorAll(selector: string) {
      return parsedDocument.querySelectorAll(selector);
    },
    cloneNode(deep?: boolean) {
      return parsedDocument.cloneNode(deep);
    },
  };
}

function restoreGlobalValue(globalObject: MutableGlobal, key: string, value: unknown) {
  if (value === undefined) {
    delete globalObject[key];
    return;
  }

  globalObject[key] = value;
}

/**
 * Defuddle expects browser DOM globals while walking linkedom documents.
 * Install them only for the duration of the extraction and always restore
 * the previous runtime globals afterwards.
 */
async function runWithDefuddleDomGlobals<T>(
  dom: LinkedomDom,
  callback: () => Promise<T> | T
) {
  const globalObject = globalThis as MutableGlobal;
  const document = dom.document as MutableDocument;
  const previousDocument = globalObject.document;
  const previousNode = globalObject.Node;
  const previousHTMLElement = globalObject.HTMLElement;
  const previousDOMParser = globalObject.DOMParser;
  const previousWindow = globalObject.window;
  const previousImplementation = document.implementation;

  document.implementation = {
    ...previousImplementation,
    createHTMLDocument:
      previousImplementation?.createHTMLDocument?.bind(previousImplementation) ??
      createTurndownDocument,
  };

  try {
    globalObject.document = document;
    globalObject.Node = dom.Node;
    globalObject.HTMLElement = dom.HTMLElement;
    globalObject.DOMParser = dom.DOMParser ?? DOMParser;
    globalObject.window = dom.window;

    return await Promise.resolve(callback());
  } finally {
    if (previousImplementation === undefined) {
      delete (document as { implementation?: unknown }).implementation;
    } else {
      document.implementation = previousImplementation;
    }

    restoreGlobalValue(globalObject, 'document', previousDocument);
    restoreGlobalValue(globalObject, 'Node', previousNode);
    restoreGlobalValue(globalObject, 'HTMLElement', previousHTMLElement);
    restoreGlobalValue(globalObject, 'DOMParser', previousDOMParser);
    restoreGlobalValue(globalObject, 'window', previousWindow);
  }
}

export function withDefuddleDomGlobals<T>(
  dom: LinkedomDom,
  callback: () => Promise<T> | T
): Promise<T> {
  const nextRun = defuddleDomQueue.then(
    () => runWithDefuddleDomGlobals(dom, callback),
    () => runWithDefuddleDomGlobals(dom, callback)
  );

  defuddleDomQueue = nextRun.then(
    () => undefined,
    () => undefined
  );

  return nextRun;
}
