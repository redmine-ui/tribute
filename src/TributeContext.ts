import { isTextAreaOrInput } from './helpers';
import type { Collection, ITribute, ITributeContext, TributeItem, TriggerInfo } from './type';

class TributeContext<T extends {}> implements ITributeContext<T> {
  #element?: HTMLElement;
  filteredItems?: TributeItem<T>[];
  collection?: Collection<T>;
  mentionText: string;
  externalTrigger: boolean;
  tribute: ITribute<T>;
  selectedPath?: (number | undefined)[];
  selectedOffset?: number;
  trigger?: string;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.mentionText = '';
    this.externalTrigger = false;
  }

  set element(element: HTMLElement | undefined) {
    if (element) {
      this.tribute.range.element = element;
    }

    this.#element = element;
  }

  get element() {
    return this.#element;
  }

  process(scrollTo: boolean) {
    if (this.tribute.menu.element === null || !this.collection) return;

    const ul = this.tribute.menu.element.querySelector('ul');
    if (ul === null) throw new Error('menu do not have "ul" element');

    const collection = this.collection;
    const processor = (values: T[]) => {
      // Tribute may not be active any more by the time the value callback returns
      if (!this.tribute.isActive) {
        return;
      }

      const items = this._filterItems(collection, values);
      this.filteredItems = items;

      const scroll = this.tribute.menu.render(items, collection);
      if (scroll === true && scrollTo === true) {
        this.tribute.range.positionMenuAtCaret(scrollTo);
      }
    };

    if (typeof collection.values === 'function') {
      if (collection.loadingItemTemplate) {
        ul.innerHTML = collection.loadingItemTemplate;
        this.tribute.range.positionMenuAtCaret(scrollTo);
      }

      collection.values(this.mentionText, processor);
    } else if (collection.values !== null) {
      processor(collection.values);
    }
  }

  updateSelection(info: TriggerInfo) {
    this.selectedPath = info.mentionSelectedPath;
    this.mentionText = info.mentionText || '';
    this.selectedOffset = info.mentionSelectedOffset;
  }

  showMenuForCollection(element: HTMLElement, collection?: Collection<T>): void {
    if (typeof collection === 'undefined' || this.isMaximumItemsAdded(collection, element)) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    if (element !== document.activeElement) {
      this.placeCaretAtEnd(element);
    }

    this.collection = collection;
    this.externalTrigger = true;
    this.element = element;

    if (element.isContentEditable) {
      this.insertTextAtCursor(this.collection.trigger);
    } else if (isTextAreaOrInput(element)) {
      this.insertAtCaret(element, this.collection.trigger);
    }
  }

  selectItemAtIndex(index: string, originalEvent: Event) {
    const _index = Number.parseInt(index, 10);
    if (Number.isNaN(_index) || !this.filteredItems || !this.collection || !this.element) return;

    if (this.collection.selectTemplate === null) return;

    const item = this.filteredItems[_index];
    const content = this.collection.selectTemplate(item, this.tribute);

    if (_index === -1 || !item) {
      const selectedNoMatchEvent = new CustomEvent('tribute-selected-no-match', { detail: content });
      this.element.dispatchEvent(selectedNoMatchEvent);
      return;
    }

    if (content !== null) {
      this.tribute.range.replaceTriggerText(content, true, true, originalEvent, item);
    }
  }

  // TODO: make sure this works for inputs/textareas
  private placeCaretAtEnd(el: HTMLElement) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  // for contenteditable
  private insertTextAtCursor(text: string): void {
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
  private insertAtCaret(textarea: HTMLInputElement | HTMLTextAreaElement, text: string): void {
    const scrollPos = textarea.scrollTop;
    let caretPos = textarea.selectionStart;

    if (caretPos === null || textarea.selectionEnd === null) return;

    const front = textarea.value.substring(0, caretPos);
    const back = textarea.value.substring(textarea.selectionEnd, textarea.value.length);
    textarea.value = front + text + back;
    caretPos = caretPos + text.length;
    textarea.selectionStart = caretPos;
    textarea.selectionEnd = caretPos;
    textarea.focus();
    textarea.scrollTop = scrollPos;
  }

  get isMentionLengthUnderMinimum() {
    if (!this.collection) return undefined;

    return this.mentionText.length < this.collection.menuShowMinLength;
  }

  _filterItems(collection: Collection<T>, values: T[]) {
    const opts = collection.searchOpts;
    const lookup = collection.lookup;
    const items = this.tribute.search.filter(this.mentionText, values, {
      pre: opts.pre || '<span>',
      post: opts.post || '</span>',
      skip: opts.skip || false,
      caseSensitive: opts.caseSensitive || false,
      extract: (el) => {
        if (typeof lookup === 'string') {
          return el[lookup];
        }
        if (typeof lookup === 'function') {
          return lookup(el, this.mentionText);
        }
        throw new Error('Invalid lookup attribute, lookup must be string or function.');
      },
    });

    if (collection.menuItemLimit) {
      return items.slice(0, collection.menuItemLimit);
    }

    return items;
  }

  isMaximumItemsAdded<T extends {}>(collection: Collection<T>, element: HTMLElement): boolean {
    const result =
      (collection.maxDisplayItems && element.querySelectorAll(`[data-tribute-trigger="${collection.trigger}"]`).length >= collection.maxDisplayItems) ||
      collection.isBlocked;
    return !!result;
  }
}

export default TributeContext;
