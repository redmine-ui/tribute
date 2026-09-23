import type { Collection, ITribute, ITributeSearch, TributeItem } from './type';

export function query<T extends {}>(
  { searchOpts, lookup, values, menuItemLimit }: Collection<T>,
  search: ITributeSearch<T>,
  mentionText: string,
  callback: (items: TributeItem<T>[]) => void,
): void {
  const resolve = (values: T[]) => {
    const items = search.filter(mentionText, values, {
      pre: searchOpts.pre || '<span>',
      post: searchOpts.post || '</span>',
      skip: searchOpts.skip || false,
      caseSensitive: searchOpts.caseSensitive || false,
      extract: (el) => {
        if (typeof lookup === 'string') return el[lookup];
        if (typeof lookup === 'function') return lookup(el, mentionText);
        throw new Error('Invalid lookup attribute, lookup must be string or function.');
      },
    });
    callback(menuItemLimit ? items.slice(0, menuItemLimit) : items);
  };

  if (typeof values === 'function') {
    values(mentionText, resolve);
  } else if (values !== null) {
    resolve(values);
  }
}

export function isAsync<T extends {}>({ values }: Collection<T>): boolean {
  return typeof values === 'function';
}

export function isMaximumItemsAdded<T extends {}>({ maxDisplayItems, trigger, isBlocked }: Collection<T>, element: HTMLElement): boolean {
  const result = (maxDisplayItems && element.querySelectorAll(`[data-tribute-trigger="${trigger}"]`).length >= maxDisplayItems) || isBlocked;
  return !!result;
}

export function appendValues<T extends {}>(collection: Collection<T>, newValues: T[], replace: boolean): void {
  if (typeof collection.values === 'function') {
    throw new Error('Unable to append to values, as it is a function.');
  }
  collection.values = replace || collection.values === null ? newValues : collection.values.concat(newValues);
}

export function resolveNoMatchContent<T extends {}>({ noMatchTemplate }: Collection<T>): string | null {
  if (typeof noMatchTemplate === 'function') {
    const result = noMatchTemplate();
    return result || null;
  }
  return noMatchTemplate || null;
}

export function getItemClassName<T extends {}>({ itemClass, selectClass }: Collection<T>, isSelected: boolean): string {
  return isSelected ? `${itemClass} ${selectClass}`.trim() : itemClass;
}

export function renderMenuItem<T extends {}>({ menuItemTemplate }: Collection<T>, item: TributeItem<T>, tribute: ITribute<T>): string | HTMLElement {
  return menuItemTemplate !== null ? menuItemTemplate(item, tribute) : '';
}
