export type ChildNode = string | Node;
export type Content = ChildNode | ChildNode[];

export type Attributes = {
  class?: string | string[];
  data?: Record<string, string | number | boolean>;
  style?: Partial<CSSStyleDeclaration>;
  [key: string]: unknown;
};

function applyAttributes(el: HTMLElement, attrs?: Attributes): void {
  if (!attrs) return;

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === 'class') {
      el.className = Array.isArray(value) ? value.join(' ') : String(value);
    } else if (key === 'data' && typeof value === 'object') {
      for (const [dataKey, dataValue] of Object.entries(value as Record<string, unknown>)) {
        el.dataset[dataKey] = String(dataValue);
      }
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

function isAttributes(val: unknown): val is Attributes {
  return val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Node);
}

export type HtmlHelper = {
  h: <K extends keyof HTMLElementTagNameMap>(tagName: K, ...args: (Attributes | ChildNode | ChildNode[])[]) => HTMLElementTagNameMap[K];
  f: (...children: ChildNode[]) => DocumentFragment;
};

export function htmlHelperFor(doc: Document) {
  function appendContent(el: Element | DocumentFragment, content?: Content): void {
    if (content === undefined) return;
    for (const item of Array.isArray(content) ? content : [content]) {
      el.append(item as string | Node);
    }
  }

  const f = (...children: ChildNode[]) => {
    const fragment = doc.createDocumentFragment();
    for (const child of children) {
      if (child !== undefined && child !== null) {
        appendContent(fragment, child);
      }
    }
    return fragment;
  };

  const h: HtmlHelper['h'] = (tagName, ...args) => {
    const el = doc.createElement(tagName);
    const children: (ChildNode | ChildNode[])[] = [];

    for (const arg of args) {
      if (arg === undefined || arg === null) continue;

      if (isAttributes(arg)) {
        applyAttributes(el, arg);
      } else {
        children.push(arg as ChildNode | ChildNode[]);
      }
    }

    for (const item of children.flat()) {
      if (item !== undefined && item !== null) {
        appendContent(el, item);
      }
    }

    return el;
  };

  return { h, f };
}

export const { h, f } = htmlHelperFor(document);
