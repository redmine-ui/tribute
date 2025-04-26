import type { Collection, ITribute, ITributeContext, TributeItem, TriggerInfo } from './type';

class TributeContext<T extends { disabled?: boolean }> implements ITributeContext<T> {
  element?: HTMLElement;
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

      if (!items.length) {
        this._handleNoItem(ul, collection, scrollTo);
      } else {
        this._renderMenu(items, ul, collection, scrollTo);
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

  _handleNoItem(ul: HTMLElement, collection: Collection<T>, scrollTo: boolean) {
    if (!this.element) throw new Error('element is empty');

    const noMatchEvent = new CustomEvent('tribute-no-match', {
      detail: this.tribute.menu.element,
    });
    this.element.dispatchEvent(noMatchEvent);
    if ((typeof collection.noMatchTemplate === 'function' && !collection.noMatchTemplate()) || !collection.noMatchTemplate) {
      this.tribute.hideMenu();
    } else {
      ul.innerHTML = typeof collection.noMatchTemplate === 'function' ? collection.noMatchTemplate() : collection.noMatchTemplate;
      this.tribute.range.positionMenuAtCaret(scrollTo);
    }
  }

  _renderMenu(items: TributeItem<T>[], ul: HTMLElement, collection: Collection<T>, scrollTo: boolean) {
    ul.innerHTML = '';
    const doc = this.tribute.range.getDocument();
    const fragment = doc.createDocumentFragment();

    this.tribute.menu.selected = items.findIndex((item) => item.original.disabled !== true);

    items.forEach((item, index) => {
      const li = this._createMenuItem(item, collection, index, doc);
      fragment.appendChild(li);
    });
    ul.appendChild(fragment);

    this.tribute.range.positionMenuAtCaret(scrollTo);
  }

  _createMenuItem(item: TributeItem<T>, collection: Collection<T>, index: number, doc: Document) {
    const li = doc.createElement('li');
    li.setAttribute('data-index', index.toString());
    if (item.original.disabled) {
      li.setAttribute('data-disabled', 'true');
    }
    li.className = collection.itemClass;
    li.addEventListener('mousemove', (e: Event) => {
      const [li, index] = this._findLiTarget(e.target);
      if ('movementY' in e && e.movementY !== 0 && index !== null && typeof index !== 'undefined') {
        this.tribute.menu.setActiveLi(Number.parseInt(index));
      }
    });
    if (this.tribute.menu.selected === index) {
      li.classList.add(collection.selectClass);
    }
    // remove all content in the li and append the content of menuItemTemplate
    const menuItemDomOrString = collection.menuItemTemplate(item);
    if (menuItemDomOrString instanceof Element) {
      li.innerHTML = '';
      li.appendChild(menuItemDomOrString);
    } else {
      li.innerHTML = menuItemDomOrString;
    }
    return li;
  }

  _findLiTarget(el: EventTarget | null): [] | [EventTarget, string | null] {
    if (!el || !(el instanceof HTMLElement)) return [];
    const index = el.getAttribute('data-index');
    return !index ? this._findLiTarget(el.parentNode) : [el, index];
  }
}

export default TributeContext;
