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

export function debounce<F extends (...args: unknown[]) => void>(func: F, wait: number, immediate = false) {
  let timeout: ReturnType<typeof setTimeout> | null;
  return function (this: ThisParameterType<F>, ...args: Parameters<F>) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(this, args);
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
