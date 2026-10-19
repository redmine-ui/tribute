import { debouncePromise } from './helpers';
import type { HtmlHelper } from './html';
import type { Collection, ITribute, ITributeSearch, StringOrElementTemplate, TributeItem, TributeSearchOpts } from './type';

export function defaultSeachOpts<T extends {}>({ extract, wrap }: { extract?: TributeSearchOpts<T>['extract']; wrap?: TributeSearchOpts<T>['wrap'] } = {}) {
  return { pre: '<span>', post: '</span>', wrap: wrap, skip: false, caseSensitive: false, extract: extract };
}

export function query<T extends {}>(
  collection: Collection<T>,
  search: ITributeSearch<T>,
  mentionText: string,
  htmlHelper: HtmlHelper,
  callback: (items: TributeItem<T>[]) => void,
): void {
  function createOptions({ searchOpts, lookup }: Collection<T>): TributeSearchOpts<T> {
    const wrap = (text?: string) => htmlHelper.h('span', text ?? '');
    const extract: TributeSearchOpts<T>['extract'] = (el) => {
      if (typeof lookup === 'string') return el[lookup];
      if (typeof lookup === 'function') return lookup(el, mentionText);
      throw new Error('Invalid lookup attribute, lookup must be string or function.');
    };
    return {
      ...defaultSeachOpts({ wrap, extract }),
      ...searchOpts,
    };
  }

  function resolveValues(values: Collection<T>['values'], onResolve: (values: T[]) => void) {
    if (Array.isArray(values)) {
      onResolve(values);
      return;
    }

    if (isPromise(values)) {
      values.then(onResolve).catch(() => callback([]));
      return;
    }

    if (typeof values === 'function') {
      // Do not reverse the order of if and else. A function taking two arguments
      // is considered to also accept a function taking one argument.
      if (isPromiseValues(values)) {
        values(mentionText)
          .then(onResolve)
          .catch(() => callback([]));
      } else {
        values(mentionText, onResolve);
      }
    }
  }

  resolveValues(collection.values, (values) => {
    const items = search.filter(mentionText, values, createOptions(collection), htmlHelper);

    const { menuItemLimit } = collection;
    callback(menuItemLimit ? items.slice(0, menuItemLimit) : items);
  });
}

export function isAsync<T extends {}>({ values }: Collection<T>): boolean {
  return typeof values === 'function';
}

export function isMaximumItemsAdded<T extends {}>({ maxDisplayItems, trigger, isBlocked }: Collection<T>, element: HTMLElement): boolean {
  const result = (maxDisplayItems && element.querySelectorAll(`[data-tribute-trigger="${trigger}"]`).length >= maxDisplayItems) || isBlocked;
  return !!result;
}

export function appendValues<T extends {}>(collection: Collection<T>, newValues: T[], replace: boolean): void {
  if (!Array.isArray(collection.values)) {
    throw new Error('Unable to append to values, as it is a function or a promise.');
  }
  collection.values = replace || collection.values === null ? newValues : collection.values.concat(newValues);
}

export function resolveContent<T extends {}>(tribute: ITribute<T>, template: StringOrElementTemplate<T>, htmlHelper: HtmlHelper): string | HTMLElement | null {
  if (typeof template === 'function') {
    const result = template(tribute, htmlHelper);
    return result || null;
  }
  return template || null;
}

export function getItemClassName<T extends {}>({ itemClass, selectClass }: Collection<T>, isSelected: boolean): string {
  return isSelected ? `${itemClass} ${selectClass}`.trim() : itemClass;
}

export function renderMenuItem<T extends {}>(
  { menuItemTemplate }: Collection<T>,
  item: TributeItem<T>,
  tribute: ITribute<T>,
  htmlHelper: HtmlHelper,
): string | HTMLElement | DocumentFragment {
  return menuItemTemplate !== null ? menuItemTemplate(item, tribute, htmlHelper) : '';
}

function isPromise(val: unknown): val is Promise<unknown> {
  return val !== null && (typeof val === 'object' || typeof val === 'function') && typeof (val as Record<string, unknown>).then === 'function';
}

type CallbackValues<T extends {}> = (text: string, cb: (result: Array<T>) => void) => void;
type PromiseValues<T extends {}> = (text: string) => Promise<Array<T>>;

function isPromiseValues<T extends {}>(fn: CallbackValues<T> | PromiseValues<T>): fn is PromiseValues<T> {
  return fn.length < 2;
}

function toPromise<T extends {}>(fn: CallbackValues<T> | PromiseValues<T>): PromiseValues<T> {
  if (isPromiseValues(fn)) return fn;
  return (text: string) => new Promise<Array<T>>((resolve) => fn(text, resolve));
}

function toCallback<T extends {}>(fn: PromiseValues<T>): CallbackValues<T> {
  return (text: string, cb: (result: Array<T>) => void) => {
    fn(text)
      .then(cb)
      .catch(() => cb([]));
  };
}

export function debounceValues<T extends {}>(values: CallbackValues<T> | PromiseValues<T>, wait: number): CallbackValues<T> | PromiseValues<T> {
  const debounced = debouncePromise(toPromise(values), wait);
  return isPromiseValues(values) ? debounced : toCallback(debounced);
}
