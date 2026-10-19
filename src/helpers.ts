export function addHandler(element: EventTarget, ...args: [string, (event: Event) => void, boolean?]) {
  element.addEventListener(...args);
  return () => element.removeEventListener(...args);
}

export function isTextAreaOrInput(element: unknown): element is HTMLInputElement | HTMLTextAreaElement {
  if (!element || typeof element !== 'object' || !('nodeName' in element)) {
    return false;
  }
  const nodeName = (element as { nodeName?: unknown }).nodeName;
  return nodeName === 'INPUT' || nodeName === 'TEXTAREA';
}

export function isNotTextAreaOrInput(element: unknown): boolean {
  return !isTextAreaOrInput(element);
}

export function isKeyOfObject<T extends object>(key: string | number | symbol, obj: T | undefined): key is keyof T {
  if (!obj) return false;

  return key in obj;
}

export function debounce<Args extends unknown[]>(func: (...args: Args) => void, wait: number, immediate = false): (...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args): void => {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
}

export function debouncePromise<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>, wait: number): (...args: Args) => Promise<R> {
  let settle: { resolve: (value: Promise<R>) => void; reject: (reason: unknown) => void } | undefined;

  const debounced = debounce((...args: Args) => {
    const current = settle;
    settle = undefined;
    if (!current) return;
    try {
      current.resolve(fn(...args));
    } catch (err) {
      current.reject(err);
    }
  }, wait);

  return (...args: Args): Promise<R> => {
    return new Promise<R>((resolve, reject) => {
      settle = { resolve, reject };
      debounced(...args);
    });
  };
}

export function isJQuery<T>(element: unknown): element is JQuery<T> {
  if (typeof element !== 'object' || element == null) {
    return false;
  }
  return 'jquery' in element && typeof element.jquery !== 'undefined';
}

type Compact<T> = {
  [P in keyof T]?: Exclude<T[P], undefined>;
};

export function compactObject<T extends Record<string, unknown>>(args: T): Compact<T> {
  const entries = Object.entries(args) as [keyof T, T[keyof T]][];
  const filteredEntries = entries.filter(([, value]) => value !== undefined);
  const compactArgs = Object.assign({}, ...filteredEntries.map(([k, v]) => ({ [k]: v }))) as Compact<T>;

  return compactArgs;
}

export function renderInto(ul: HTMLElement, content: string | HTMLElement): void {
  if (isElement(content)) {
    ul.replaceChildren();
    ul.appendChild(content);
  } else {
    ul.innerHTML = content;
  }
}

/**
 * Safe for cross-iframe environments where `instanceof` fails due to different `window` contexts.
 */

const isObject = (v: unknown): v is object => typeof v === 'object' && v !== null;

export const isNode = (v: unknown): v is Node => isObject(v) && typeof (v as Node).nodeType === 'number';

export const isElement = (v: unknown): v is Element => isNode(v) && v.nodeType === 1;

export const isDocumentFragment = (v: unknown): v is DocumentFragment => isNode(v) && v.nodeType === 11;

export const isHTMLElement = (v: unknown): v is HTMLElement => isElement(v) && v.namespaceURI === 'http://www.w3.org/1999/xhtml';

export const isKeyboardEvent = (v: unknown): v is KeyboardEvent => isObject(v) && typeof (v as KeyboardEvent).key === 'string';

function isCollection(value: unknown): value is { length: number; item: (index: number) => unknown } {
  return isObject(value) && 'length' in value && typeof value.length === 'number' && 'item' in value && typeof value.item === 'function';
}

export const isNodeList = (value: unknown): value is NodeList => isCollection(value) && !('namedItem' in value);

export const isHTMLCollection = (value: unknown): value is HTMLCollection => isCollection(value) && 'namedItem' in value;
