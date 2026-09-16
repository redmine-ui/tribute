import { compactObject, isJQuery, isKeyOfObject, isNotTextAreaOrInput } from './helpers';
import TributeContext from './TributeContext';
import TributeEvents from './TributeEvents';
import TributeMenu from './TributeMenu';
import TributeMenuEvents from './TributeMenuEvents';
import TributeRange from './TributeRange';
import TributeSearch from './TributeSearch';
import { isMaximumItemsAdded, appendValues } from './collection';
import type {
  Collection,
  ITribute,
  ITributeContext,
  ITributeEvents,
  ITributeMenu,
  ITributeRange,
  ITributeSearch,
  TributeArgument,
  TributeCollection,
  TributeElement,
  TributeItem,
  TributeTemplate,
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

class Tribute<T extends {}> implements ITribute<T> {
  allowSpaces: boolean;
  autocompleteMode: boolean;
  autocompleteSeparator: RegExp | null;
  collection: Collection<T>[];
  iframe?: HTMLIFrameElement;
  closeOnScroll: boolean | HTMLElement;
  currentMentionTextSnapshot?: string;
  hasTrailingSpace: boolean;
  menu: ITributeMenu<T>;
  menuContainer?: Element | null;
  positionMenu: boolean;
  replaceTextSuffix: string | null;
  spaceSelectsMatch: boolean;
  events: ITributeEvents;
  menuEvents: ITributeEvents;
  search: ITributeSearch<T>;
  current: ITributeContext<T>;
  private rangeMap = new Map<HTMLElement, TributeRange<T>>();

  constructor(args: Partial<TributeCollection<T> & TributeTemplate<T> & TributeArgument<T>>) {
    const compactArgs = compactObject(args);

    const config = {
      ...defaultConfig,
      ...compactArgs,
    };

    this.autocompleteMode = config.autocompleteMode;
    this.autocompleteSeparator = config.autocompleteSeparator;
    this.current = new TributeContext(this);
    this.menuContainer = config.menuContainer;
    this.allowSpaces = config.allowSpaces;
    this.replaceTextSuffix = config.replaceTextSuffix;
    this.positionMenu = config.positionMenu;
    this.hasTrailingSpace = false;
    this.spaceSelectsMatch = config.spaceSelectsMatch;
    this.closeOnScroll = config.closeOnScroll;
    this.menu = new TributeMenu(this);

    if (this.autocompleteMode) {
      config.trigger = '';
      config.allowSpaces = false;
    }

    this.collection = this.buildCollection(config);
    this.events = new TributeEvents(this);
    this.menuEvents = new TributeMenuEvents(this);
    this.search = new TributeSearch(this);
  }

  get isActive(): boolean {
    return this.current.isActive;
  }

  set isActive(value: boolean) {
    if (value) {
      this.current.activate();
    } else {
      this.current.deactivate();
    }
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
    if (_el instanceof NodeList || _el instanceof HTMLCollection || Array.isArray(_el)) {
      for (const e of _el) {
        if (e instanceof HTMLElement) {
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
    this.rangeMap.set(el, new TributeRange(this, el));
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
    this.current.showMenuForCollection(element, collection);
    this.showMenuFor(element);
  }

  showMenuFor(element: HTMLElement & { tributeMenu?: HTMLElement }, scrollTo?: boolean): void {
    if (typeof this.current.collection === 'undefined') return;

    // Check for maximum number of items added to the input for the specific Collection
    if (isMaximumItemsAdded(this.current.collection, element)) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    this.currentMentionTextSnapshot = this.current.mentionText;

    // create the menu if it doesn't exist.
    if (!this.menu.element) {
      const doc = this.current.range?.getDocument();
      if (doc) {
        const menu = this.menu.create(doc, this.current.collection.containerClass);
        element.tributeMenu = menu;
        this.menuEvents.bind(menu);
      }
    }

    this.current.activate();
    this.menu.activate();

    this.current.process(scrollTo);
  }

  hideMenu(): void {
    if (this.menu.isActive) {
      this.current.deactivate();
      this.menu.deactivate();
      this.current = new TributeContext(this);
    }
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
    if (this.isActive && typeof this.current.collection !== 'undefined') {
      appendValues(this.current.collection, newValues, replace);
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
    if (_el instanceof NodeList || _el instanceof HTMLCollection || Array.isArray(_el)) {
      for (const e of _el) {
        if (e instanceof HTMLElement) {
          this._detach(e);
        }
      }
    } else {
      this._detach(_el);
    }
  }

  _detach(el: HTMLElement & { tributeMenu?: HTMLElement }): void {
    this.rangeMap.delete(el);
    this.events.unbind(el);
    if (el.tributeMenu) {
      this.menuEvents.unbind(el.tributeMenu);
    }

    setTimeout(() => {
      el.removeAttribute('data-tribute');
      this.current.deactivate();
      if (el.tributeMenu) {
        el.tributeMenu.remove();
      }
    });
  }

  rangeFor(element: HTMLElement): ITributeRange<T> {
    const range = this.rangeMap.get(element);
    if (!range) throw new Error('Tribute is not attached to this element');
    return range;
  }

  private buildCollection(config: TributeCollection<T> & TributeTemplate<T> & TributeArgument<T>) {
    const { values, collection, menuItemTemplate, noMatchTemplate, selectTemplate, ...collectionConfig } = config;

    if (values) {
      return [
        {
          ...collectionConfig,
          values: values,
          selectTemplate: selectTemplate ? selectTemplate.bind(this) : (item?: TributeItem<T>) => defaultSelectTemplate(this.current, item),
          menuItemTemplate: (menuItemTemplate || defaultMenuItemTemplate).bind(this),
          noMatchTemplate: this.createNoMatchTemplate(noMatchTemplate, noMatchTemplate),
        },
      ];
    }

    if (collection) {
      if (this.autocompleteMode) console.warn('Tribute in autocomplete mode does not work for collections');
      return collection.map((item) => ({
        ...collectionConfig,
        ...item,
        selectTemplate: item.selectTemplate ? item.selectTemplate.bind(this) : (item?: TributeItem<T>) => defaultSelectTemplate(this.current, item),
        menuItemTemplate: (item.menuItemTemplate || defaultMenuItemTemplate).bind(this),
        noMatchTemplate: this.createNoMatchTemplate(item.noMatchTemplate, noMatchTemplate),
      }));
    } else {
      throw new Error('[Tribute] No collection specified.');
    }
  }

  private createNoMatchTemplate(template: TributeTemplate<T>['noMatchTemplate'], defaultNoMatchTemplate: TributeTemplate<T>['noMatchTemplate']) {
    if (typeof template === 'string') {
      return template.trim() === '' ? null : template;
    }

    if (typeof template === 'function') {
      return template.bind(this);
    }

    return defaultNoMatchTemplate ?? (() => '<li>No Match Found!</li>').bind(this);
  }

  static isContentEditable(element: HTMLElement) {
    return isNotTextAreaOrInput(element);
  }
}

function defaultSelectTemplate<T extends {}>(current: ITributeContext<T> | undefined, item?: TributeItem<T>): string {
  if (!current?.collection) {
    throw new Error('current Collection is undefined');
  }
  const result = isKeyOfObject(current.collection.fillAttr, item?.original)
    ? (item?.original?.[current.collection.fillAttr] ?? current.mentionText)
    : current.mentionText;
  const trigger = current.collection.trigger ?? '';

  if (current.element && isNotTextAreaOrInput(current.element)) {
    return `<span class="tribute-mention">${trigger}${result}</span>`;
  }
  return `${trigger}${result}`;
}

function defaultMenuItemTemplate<T extends {}>(matchItem: TributeItem<T>) {
  return matchItem.string;
}

export default Tribute;
