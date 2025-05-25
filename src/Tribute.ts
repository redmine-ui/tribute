import TributeContext from './TributeContext';
import TributeEvents from './TributeEvents';
import TributeMenu from './TributeMenu';
import TributeMenuEvents from './TributeMenuEvents';
import TributeRange from './TributeRange';
import TributeSearch from './TributeSearch';
import { isContentEditable, isNotContentEditable } from './helpers';
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
  _isActive: boolean;
  events: ITributeEvents;
  menuEvents: ITributeEvents;
  range: ITributeRange<T>;
  search: ITributeSearch<T>;
  current: ITributeContext<T>;

  constructor({
    values = null,
    loadingItemTemplate = null,
    iframe = null,
    shadowRoot = null,
    selectClass = 'highlight',
    containerClass = 'tribute-container',
    itemClass = '',
    trigger = '@',
    autocompleteMode = false,
    autocompleteSeparator = /\s+/,
    selectTemplate = null,
    menuItemTemplate = null,
    lookup = 'key',
    fillAttr = 'value',
    collection = null,
    menuContainer = null,
    noMatchTemplate = null,
    requireLeadingSpace = true,
    allowSpaces = false,
    replaceTextSuffix = null,
    positionMenu = true,
    spaceSelectsMatch = false,
    searchOpts = {},
    menuItemLimit = null,
    menuShowMinLength = 0,
    closeOnScroll = false,
    maxDisplayItems = null,
    isBlocked = false,
  }: TributeCollection<T> & TributeTemplate<T> & TributeArgument<T>) {
    this._isActive = false;
    this.autocompleteMode = autocompleteMode;
    this.autocompleteSeparator = autocompleteSeparator;
    this.current = new TributeContext(this);
    this.isActive = false;
    this.menuContainer = menuContainer;
    this.allowSpaces = allowSpaces;
    this.replaceTextSuffix = replaceTextSuffix;
    this.positionMenu = positionMenu;
    this.hasTrailingSpace = false;
    this.spaceSelectsMatch = spaceSelectsMatch;
    this.closeOnScroll = closeOnScroll;
    this.menu = new TributeMenu(this);

    if (this.autocompleteMode) {
      trigger = '';
      allowSpaces = false;
    }

    if (values) {
      this.collection = [
        {
          // symbol that starts the lookup
          trigger: trigger,

          // is it wrapped in an iframe
          iframe: iframe,

          // is it wrapped in a web component
          shadowRoot: shadowRoot,

          // class applied to selected item
          selectClass: selectClass,

          // class applied to the Container
          containerClass: containerClass,

          // class applied to each item
          itemClass: itemClass,

          // function called on select that retuns the content to insert
          selectTemplate: selectTemplate ? selectTemplate.bind(this) : (item) => defaultSelectTemplate(this.current, item),

          // function called that returns content for an item
          menuItemTemplate: (menuItemTemplate || defaultMenuItemTemplate).bind(this),

          // function called when menu is empty, disables hiding of menu.
          noMatchTemplate: ((t) => {
            if (typeof t === 'string') {
              if (t.trim() === '') return null;
              return t;
            }
            if (typeof t === 'function') {
              return t.bind(this);
            }

            return noMatchTemplate || (() => '<li>No Match Found!</li>').bind(this);
          })(noMatchTemplate),

          // column to search against in the object
          lookup: lookup,

          // column that contains the content to insert by default
          fillAttr: fillAttr,

          // array of objects or a function returning an array of objects
          values: values,

          // useful for when values is an async function
          loadingItemTemplate: loadingItemTemplate,

          requireLeadingSpace: requireLeadingSpace,

          searchOpts: searchOpts,

          menuItemLimit: menuItemLimit,

          menuShowMinLength: menuShowMinLength,

          // Fix for maximum number of items added to the input for the specific Collection
          maxDisplayItems: maxDisplayItems,

          isBlocked: isBlocked,
        },
      ];
    } else if (collection) {
      if (this.autocompleteMode) console.warn('Tribute in autocomplete mode does not work for collections');
      this.collection = collection.map((item) => {
        return {
          trigger: item.trigger || trigger,
          iframe: item.iframe || iframe,
          selectClass: item.selectClass || selectClass,
          containerClass: item.containerClass || containerClass,
          itemClass: item.itemClass || itemClass,
          selectTemplate: item.selectTemplate ? item.selectTemplate.bind(this) : (item) => defaultSelectTemplate(this.current, item),
          menuItemTemplate: (item.menuItemTemplate || defaultMenuItemTemplate).bind(this),
          // function called when menu is empty, disables hiding of menu.
          noMatchTemplate: ((t) => {
            if (typeof t === 'string') {
              if (t.trim() === '') return null;
              return t;
            }
            if (typeof t === 'function') {
              return t.bind(this);
            }

            return noMatchTemplate ?? (() => '<li>No Match Found!</li>').bind(this);
          })(item.noMatchTemplate),
          lookup: item.lookup || lookup,
          fillAttr: item.fillAttr || fillAttr,
          values: item.values,
          loadingItemTemplate: item.loadingItemTemplate,
          requireLeadingSpace: item.requireLeadingSpace,
          searchOpts: item.searchOpts || searchOpts,
          menuItemLimit: item.menuItemLimit || menuItemLimit,
          menuShowMinLength: item.menuShowMinLength || menuShowMinLength,

          // Set maximum number of items added to the input for the specific Collection
          maxDisplayItems: item.maxDisplayItems || maxDisplayItems,
          isBlocked: item.isBlocked || isBlocked,
        };
      });
    } else {
      throw new Error('[Tribute] No collection specified.');
    }

    this.range = new TributeRange(this);
    this.events = new TributeEvents(this);
    this.menuEvents = new TributeMenuEvents(this);
    this.search = new TributeSearch(this);
  }

  get isActive(): boolean {
    return this._isActive;
  }

  set isActive(val: boolean) {
    if (this._isActive !== val) {
      this._isActive = val;
      if (this.current.element) {
        const noMatchEvent = new CustomEvent(`tribute-active-${val}`);
        this.current.element.dispatchEvent(noMatchEvent);
      }
    }
  }

  triggers() {
    return this.collection.map((config) => {
      return config.trigger;
    });
  }

  attach(el: TributeElement | JQuery<HTMLElement>): void {
    // Check if it is a jQuery collection
    let _el: HTMLElement | NodeList | HTMLCollection | Array<HTMLElement>;
    if (isJQuery<HTMLElement>(el)) {
      _el = el.get();
    } else {
      _el = el;
    }

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
    this.events.bind(el);
    el.setAttribute('data-tribute', 'true');
  }

  ensureEditable(element: HTMLElement): void {
    if (isContentEditable(element)) {
      if (typeof element.contentEditable === 'string') {
        element.contentEditable = 'true';
      } else {
        throw new Error(`[Tribute] Cannot bind to ${element.nodeName}, not contentEditable`);
      }
    }
  }

  showMenuFor(element: HTMLElement & { tributeMenu?: HTMLElement }, scrollTo?: boolean): void {
    if (typeof this.current.collection === 'undefined') throw new Error('this.current.collection is undefined');

    // Check for maximum number of items added to the input for the specific Collection
    if (isMaximumItemsAdded(this.current.collection, element)) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    this.currentMentionTextSnapshot = this.current.mentionText;

    // create the menu if it doesn't exist.
    if (!this.menu.element) {
      const menu = this.menu.create(this.range.getDocument(), this.current.collection.containerClass);
      element.tributeMenu = menu;
      this.menuEvents.bind(menu);
    }

    this.isActive = true;
    this.menu.activate();

    this.current.process(scrollTo);
  }

  showMenuForCollection(element: HTMLElement, collectionIndex?: number): void {
    // Check for maximum number of items added to the input for the specific Collection
    const index = collectionIndex || 0;
    const collection = this.collection[index];
    if (typeof collection === 'undefined' || isMaximumItemsAdded(collection, element)) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    if (element !== document.activeElement) {
      this.placeCaretAtEnd(element);
    }

    this.current.collection = collection;
    this.current.externalTrigger = true;
    this.current.element = element;

    if (element.isContentEditable) {
      this.insertTextAtCursor(this.current.collection.trigger);
    } else if (isNotContentEditable(element)) {
      this.insertAtCaret(element, this.current.collection.trigger);
    }

    this.showMenuFor(element);
  }

  // TODO: make sure this works for inputs/textareas
  placeCaretAtEnd(el: HTMLElement) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  // for contenteditable
  insertTextAtCursor(text: string): void {
    const sel = window.getSelection();
    const range = sel?.getRangeAt(0);
    if (!sel || !range) return;

    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.selectNodeContents(textNode);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // for regular inputs
  insertAtCaret(textarea: HTMLInputElement | HTMLTextAreaElement, text: string): void {
    const scrollPos = textarea.scrollTop;
    let caretPos = textarea.selectionStart;

    if (!caretPos || !textarea.selectionEnd) return;

    const front = textarea.value.substring(0, caretPos);
    const back = textarea.value.substring(textarea.selectionEnd, textarea.value.length);
    textarea.value = front + text + back;
    caretPos = caretPos + text.length;
    textarea.selectionStart = caretPos;
    textarea.selectionEnd = caretPos;
    textarea.focus();
    textarea.scrollTop = scrollPos;
  }

  hideMenu(): void {
    if (this.menu.isActive) {
      this.isActive = false;
      this.menu.deactivate();
      this.current = new TributeContext(this);
    }
  }

  selectItemAtIndex(index: string, originalEvent: Event) {
    const _index = Number.parseInt(index);
    if (typeof _index !== 'number' || Number.isNaN(_index) || !this.current.filteredItems || !this.current.collection || !this.current.element) return;

    const item = this.current.filteredItems[_index];
    const content = this.current.collection.selectTemplate(item);

    if (_index === -1 || !item) {
      const selectedNoMatchEvent = new CustomEvent('tribute-selected-no-match', { detail: content });
      this.current.element.dispatchEvent(selectedNoMatchEvent);
      return;
    }

    if (content !== null) {
      this.replaceText(content, originalEvent, item);
    }
  }

  replaceText(content: string | HTMLElement, originalEvent: Event, item: TributeItem<T>): void {
    this.range.replaceTriggerText(content, true, true, originalEvent, item);
  }

  _append(collection: TributeCollection<T>, newValues: T[], replace: boolean): void {
    if (typeof collection.values === 'function') {
      throw new Error('Unable to append to values, as it is a function.');
    }
    if (replace || collection.values === null) {
      collection.values = newValues;
    } else {
      collection.values = collection.values.concat(newValues);
    }
  }

  append(collectionIndex: string, newValues: [], replace?: boolean): void {
    const index = Number.parseInt(collectionIndex);
    if (typeof index !== 'number') throw new Error('please provide an index for the collection to update.');

    const collection = this.collection[index];

    if (typeof collection !== 'undefined') {
      this._append(collection, newValues, !!replace);
    }
  }

  appendCurrent(newValues: T[], replace: boolean): void {
    if (this.isActive && typeof this.current.collection !== 'undefined') {
      this._append(this.current.collection, newValues, replace);
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
    this.events.unbind(el);
    if (el.tributeMenu) {
      this.menuEvents.unbind(el.tributeMenu);
    }

    setTimeout(() => {
      el.removeAttribute('data-tribute');
      this.isActive = false;
      if (el.tributeMenu) {
        el.tributeMenu.remove();
      }
    });
  }

  static isContentEditable(element: HTMLElement) {
    return isContentEditable(element);
  }
}

function defaultSelectTemplate<T extends {}>(current: ITributeContext<T> | undefined, item?: TributeItem<T>): string {
  if (typeof current?.collection === 'undefined') throw new Error('current Collection is undfined');
  if (typeof item === 'undefined') return `${current.collection.trigger}${current.mentionText}`;

  // FIXME: should not use 'as'
  const original = item.original as { [key: string]: string };
  const result = original[current.collection.fillAttr];

  if (current.element && isContentEditable(current.element)) {
    return `<span class="tribute-mention">${current.collection.trigger}${result}</span>`;
  }

  return `${current.collection.trigger}${result}`;
}

function defaultMenuItemTemplate<T extends {}>(matchItem: TributeItem<T>) {
  return matchItem.string;
}

function isMaximumItemsAdded<T extends {}>(collection: Collection<T>, element: HTMLElement): boolean {
  const result =
    (collection.maxDisplayItems && element.querySelectorAll(`[data-tribute-trigger="${collection.trigger}"]`).length >= collection.maxDisplayItems) ||
    collection.isBlocked;
  return !!result;
}

function isJQuery<T>(element: unknown): element is JQuery<T> {
  if (typeof element !== 'object' || element == null) {
    return false;
  }
  return 'jquery' in element && typeof element.jquery !== 'undefined';
}

export default Tribute;
