import { appendValues, debounceValues } from './collection';
import { compactObject, isHTMLCollection, isHTMLElement, isJQuery, isKeyOfObject, isNodeList, isNotTextAreaOrInput } from './helpers';
import { htmlHelperFor } from './html';
import TributeContext from './TributeContext';
import TributeEvents from './TributeEvents';
import TributeMenuEvents from './TributeMenuEvents';
import TributeSearch from './TributeSearch';
import type {
  Collection,
  ITribute,
  ITributeContext,
  ITributeEvents,
  ITributeMenuEvents,
  ITributeSearch,
  StringOrElementTemplate,
  TributeArgument,
  TributeCollection,
  TributeElement,
  TributeItem,
  TributeTemplate,
  TributeValues,
} from './type';

const defaultConfig = {
  values: null,
  loadingItemTemplate: null,
  iframe: null,
  shadowRoot: null,
  selectClass: 'highlight',
  containerClass: 'tribute-container',
  itemClass: '',
  trigger: '@',
  autocompleteMode: false,
  autocompleteSeparator: /\s+/,
  selectTemplate: null,
  menuItemTemplate: null,
  lookup: 'key',
  fillAttr: 'value',
  collection: null,
  menuContainer: null,
  noMatchTemplate: null,
  requireLeadingSpace: true,
  allowSpaces: false,
  replaceTextSuffix: null,
  positionMenu: true,
  spaceSelectsMatch: false,
  searchOpts: {},
  menuItemLimit: null,
  menuShowMinLength: 0,
  closeOnScroll: false,
  maxDisplayItems: null,
  isBlocked: false,
} as const;

type TributeCollectionConfig<T extends {}> = TributeCollection<T> & TributeTemplate<T> & TributeArgument<T>;

class Tribute<T extends {}> implements ITribute<T> {
  allowSpaces: boolean;
  autocompleteMode: boolean;
  autocompleteSeparator: RegExp | null;
  collection: Collection<T>[];
  iframe?: HTMLIFrameElement;
  closeOnScroll: boolean | HTMLElement;
  currentMentionTextSnapshot?: string;
  hasTrailingSpace: boolean;
  menuContainer?: Element | null;
  positionMenu: boolean;
  replaceTextSuffix: string | null;
  spaceSelectsMatch: boolean;
  events: ITributeEvents;
  menuEvents: ITributeMenuEvents<T>;
  search: ITributeSearch<T>;
  private contextMap = new Map<HTMLElement, ITributeContext<T>>();

  constructor(args: Partial<TributeCollectionConfig<T>>) {
    const compactArgs = compactObject(args);

    const config = {
      ...defaultConfig,
      ...compactArgs,
    };

    this.autocompleteMode = config.autocompleteMode;
    this.autocompleteSeparator = config.autocompleteSeparator;
    this.menuContainer = config.menuContainer;
    this.allowSpaces = config.allowSpaces;
    this.replaceTextSuffix = config.replaceTextSuffix;
    this.positionMenu = config.positionMenu;
    this.hasTrailingSpace = false;
    this.spaceSelectsMatch = config.spaceSelectsMatch;
    this.closeOnScroll = config.closeOnScroll;

    if (this.autocompleteMode) {
      config.trigger = '';
      config.allowSpaces = false;
    }

    this.collection = this.buildCollection(config);
    this.events = new TributeEvents(this);
    this.menuEvents = new TributeMenuEvents(this);
    this.search = new TributeSearch(this);
  }

  current?: ITributeContext<T>;

  get isActive(): boolean {
    return this.current ? this.current.isActive : false;
  }

  set isActive(value: boolean) {
    if (value) {
      this.current?.activate();
    } else {
      this.current?.deactivate();
    }
  }

  contextFor(element: HTMLElement): ITributeContext<T> {
    const context = this.contextMap.get(element);
    if (!context) throw new Error('Tribute is not attached to this element');

    return context;
  }

  triggers() {
    return this.collection.map((config) => {
      return config.trigger;
    });
  }

  attach(el: TributeElement | JQuery<HTMLElement>): void {
    // Check if it is a jQuery collection
    const _el = isJQuery<HTMLElement>(el) ? el.get() : el;
    if (!_el) {
      throw new Error('[Tribute] Must pass in a DOM node or NodeList.');
    }

    // Is el an Array/Array-like object?
    if (isNodeList(_el) || isHTMLCollection(_el) || Array.isArray(_el)) {
      for (const e of _el) {
        if (isHTMLElement(e)) {
          this._attach(e);
        }
      }
    } else {
      this._attach(_el);
    }
  }

  _attach(el: HTMLElement) {
    if (el.hasAttribute('data-tribute')) {
      console.warn(`Tribute was already bound to ${el.nodeName}`);
    }

    this.ensureEditable(el);
    const context = new TributeContext({
      tribute: this,
      element: el,
    });
    this.contextMap.set(el, context);
    if (!this.current) {
      this.current = context;
    }
    this.events.bind(el);
    el.setAttribute('data-tribute', 'true');
  }

  ensureEditable(element: HTMLElement): void {
    if (isNotTextAreaOrInput(element)) {
      if (typeof element.contentEditable === 'string') {
        element.contentEditable = 'true';
      } else {
        throw new Error(`[Tribute] Cannot bind to ${element.nodeName}, not contentEditable`);
      }
    }
  }

  showMenuForCollection(element: HTMLElement, collectionIndex?: number): void {
    // Check for maximum number of items added to the input for the specific Collection
    const index = collectionIndex || 0;
    const collection = this.collection[index];
    this.current?.showMenuForCollection(collection);
    this.showMenuFor(element);
  }

  showMenuFor(element: HTMLElement, scrollTo?: boolean): void {
    const context = this.contextFor(element);

    this.currentMentionTextSnapshot = context.mentionText;
    context.showMenuFor(element, scrollTo);
  }

  hideMenu(): void {
    this.current?.hideMenu();
  }

  append(collectionIndex: string | number, newValues: T[], replace?: boolean): void {
    const index = typeof collectionIndex === 'number' ? collectionIndex : Number.parseInt(collectionIndex, 10);
    if (typeof index !== 'number' || Number.isNaN(index)) throw new Error('please provide an index for the collection to update.');

    const collection = this.collection[index];

    if (typeof collection !== 'undefined') {
      appendValues(collection, newValues, !!replace);
    }
  }

  appendCurrent(newValues: T[], replace: boolean): void {
    if (this.isActive && typeof this.current?.collection !== 'undefined') {
      appendValues(this.current?.collection, newValues, replace);
    } else {
      throw new Error('No active state. Please use append instead and pass an index.');
    }
  }

  detach(el: TributeElement): void {
    if (!el) {
      throw new Error('[Tribute] Must pass in a DOM node or NodeList.');
    }

    // Check if it is a jQuery collection
    const _el = isJQuery(el) ? el.get() : el;

    // Is el an Array/Array-like object?
    if (isNodeList(_el) || isHTMLCollection(_el) || Array.isArray(_el)) {
      for (const e of _el) {
        if (isHTMLElement(e)) {
          this._detach(e);
        }
      }
    } else {
      this._detach(_el);
    }
  }

  _detach(el: HTMLElement): void {
    const context = this.contextFor(el);
    if (context) {
      this.contextMap.delete(el);
      this.events.unbind(el);
    }

    setTimeout(() => {
      el.removeAttribute('data-tribute');
      context.deactivate();
    });
  }

  bindMenuEvents(context: ITributeContext<T>) {
    this.menuEvents.bind(context);
  }

  unbindMenuEvents(context: ITributeContext<T>) {
    this.menuEvents.unbind(context);
  }

  get htmlHelper() {
    return this.current?.htmlHelper ?? htmlHelperFor(document);
  }

  private buildCollection(config: TributeCollectionConfig<T>) {
    const { values, debounce, collection, menuItemTemplate, noMatchTemplate, selectTemplate, loadingItemTemplate, ...collectionConfig } = config;

    if (values) {
      return [
        {
          ...collectionConfig,
          values: resolveValues(values, debounce),
          selectTemplate: resolveTemplate(this, selectTemplate, defaultSelectTemplate),
          menuItemTemplate: resolveTemplate(this, menuItemTemplate, defaultMenuItemTemplate),
          noMatchTemplate: resolveStringOrElementTemplate(this, noMatchTemplate, defaultNoMatchTemplate),
          loadingItemTemplate: resolveStringOrElementTemplate(this, loadingItemTemplate, undefined),
        },
      ];
    }

    if (collection) {
      if (this.autocompleteMode) console.warn('Tribute in autocomplete mode does not work for collections');
      return collection.map((item) => ({
        ...collectionConfig,
        ...item,
        values: resolveValues(item.values, item.debounce),
        selectTemplate: resolveTemplate(this, item.selectTemplate, defaultSelectTemplate),
        menuItemTemplate: resolveTemplate(this, item.menuItemTemplate, defaultMenuItemTemplate),
        noMatchTemplate: resolveStringOrElementTemplate(this, item.noMatchTemplate, noMatchTemplate ?? defaultNoMatchTemplate),
        loadingItemTemplate: resolveStringOrElementTemplate(this, item.loadingItemTemplate, undefined),
      }));
    } else {
      throw new Error('[Tribute] No collection specified.');
    }
  }

  static isContentEditable(element: HTMLElement) {
    return isNotTextAreaOrInput(element);
  }
}

function resolveValues<T extends {}>(values: TributeValues<T>, debounce: number | undefined): TributeValues<T> {
  if (!debounce || typeof values !== 'function') return values;
  return debounceValues(values, debounce);
}

function resolveTemplate<F extends (...args: never[]) => unknown>(tribute: unknown, custom: F | null | undefined, fallback: F): F {
  return (custom ?? fallback).bind(tribute) as F;
}

function resolveStringOrElementTemplate<T extends {}>(
  tribute: Tribute<T>,
  template: StringOrElementTemplate<T> | undefined,
  fallback: StringOrElementTemplate<T> | undefined,
): StringOrElementTemplate<T> {
  if (typeof template === 'string') {
    return template.trim() === '' ? null : template;
  }
  if (typeof template === 'function') {
    return template.bind(tribute);
  }
  return fallback ?? null;
}

function defaultSelectTemplate<T extends {}>(item: TributeItem<T> | undefined, tribute: ITribute<T>): string | HTMLElement {
  const current = tribute?.current;
  if (!current?.collection) {
    throw new Error('current Collection is undefined');
  }
  const result = isKeyOfObject(current.collection.fillAttr, item?.original)
    ? (item?.original?.[current.collection.fillAttr] ?? current.mentionText)
    : current.mentionText;
  const trigger = current.collection.trigger ?? '';

  if (current.element && isNotTextAreaOrInput(current.element)) {
    const { h } = tribute.htmlHelper;
    return h('span', `${trigger}${result}`, { class: 'tribute-mention' });
  }
  return `${trigger}${result}`;
}

function defaultMenuItemTemplate<T extends {}>(matchItem: TributeItem<T>) {
  return matchItem.string;
}

function defaultNoMatchTemplate<T extends {}>(tribute?: ITribute<T>): string | HTMLElement {
  const { h } = tribute?.htmlHelper || htmlHelperFor(document);
  return h('li', 'No Match Found!');
}

export default Tribute;
