import { isTextAreaOrInput } from './helpers';
import { isAsync, isMaximumItemsAdded, query } from './collection';
import type { Collection, ITribute, ITributeContext, ITributeRange, TributeItem, TriggerInfo, ITributeSearch } from './type';

class TributeContext<T extends {}> implements ITributeContext<T> {
  #element?: HTMLElement;
  #isActive = false;
  filteredItems?: TributeItem<T>[];
  collection?: Collection<T>;
  mentionText: string;
  externalTrigger: boolean;
  tribute: ITribute<T>;
  range?: ITributeRange<T>;
  selectedPath?: (number | undefined)[];
  selectedOffset?: number;
  trigger?: string;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.mentionText = '';
    this.externalTrigger = false;
  }

  set element(element: HTMLElement | undefined) {
    this.#element = element;
  }

  get element() {
    return this.#element;
  }

  private setActive(value: boolean) {
    if (this.#isActive !== value) {
      this.#isActive = value;
      if (this.element) {
        const noMatchEvent = new CustomEvent(`tribute-active-${value}`);
        this.element.dispatchEvent(noMatchEvent);
      }
    }
  }

  get isActive() {
    return this.#isActive;
  }

  activate() {
    this.setActive(true);
  }

  deactivate() {
    this.setActive(false);
  }

  sessionStarted(element: HTMLElement, trigger?: string) {
    if (typeof trigger === 'undefined') return;

    this.trigger = trigger;
    this.element = element;

    this.collection = this.tribute.collection.find((item) => {
      return item.trigger === trigger;
    });
  }

  queryChanged(element: HTMLElement, range: ITributeRange<T>, info?: TriggerInfo) {
    this.element = element;
    this.range = range;

    if (info) {
      this.selectedPath   = info.mentionSelectedPath;
      this.mentionText    = info.mentionText || '';
      this.selectedOffset = info.mentionSelectedOffset;
    }
  }

  refreshMenu(hotkeyHandledOnKeydown: boolean, showMenuOnBackspace: boolean) {
    if (!this.element) return;

    if (this.isMentionLengthUnderMinimum) {
      this.tribute.hideMenu();
      return;
    }

    if (((this.trigger || this.tribute.autocompleteMode) && !hotkeyHandledOnKeydown) || showMenuOnBackspace) {
      this.tribute.showMenuFor(this.element, true);
    }
  }

  selectionMoved(direction: 1 | -1): boolean {
    if (this.isActive && this.filteredItems) {
      const count = this.filteredItems.length;

      if (direction === 1) {
        this.tribute.menu.up(count);
      } else {
        this.tribute.menu.down(count);
      }

      return true
    }
    return false
  }

  selectionConfirmed(e: Event, index?: string | null): boolean {
    if (index !== undefined) {
      if (index !== null) {
        this.selectItemAtIndex(index, e);
      }
      this.tribute.hideMenu();
      return true;
    }
    const filteredItems = this.filteredItems;
    if (this.isActive && filteredItems?.length !== undefined) {
      if (filteredItems.length === 0) {
        this.tribute.menu.unselect();
      }

      setTimeout(() => {
        this.selectItemAtIndex(this.tribute.menu.selected.toString(), e);
        this.tribute.hideMenu();
      }, 0);
      return true;
    }
    return false;
  }

  sessionCanceled(): boolean {
    if (this.isActive) {
      this.tribute.hideMenu();
      return true
    }
    return false;
  }

  consumeExternalTrigger(): boolean {
    if (this.externalTrigger) {
      this.externalTrigger = false;
      return true;
    }
    return !!this.element && false;
  }

  process(scrollTo: boolean) {
    if (this.tribute.menu.element === null || !this.collection) return;

    const ul = this.tribute.menu.element.querySelector('ul');
    if (ul === null) throw new Error('menu do not have "ul" element');

    if (isAsync(this.collection) && this.collection.loadingItemTemplate) {
      ul.innerHTML = this.collection.loadingItemTemplate;
      this.range?.positionMenuAtCaret(scrollTo);
    }

    query(this.collection, this.tribute.search, this.mentionText, (items) => {
      if (!this.isActive) return;

      this.filteredItems = items;

      const scroll = this.tribute.menu.render(items, this.collection!);
      if (scroll === true && scrollTo === true) {
        this.range?.positionMenuAtCaret(scrollTo);
      }
    });
  }

  showMenuForCollection(element: HTMLElement, collection?: Collection<T>): void {
    if (typeof collection === 'undefined' || isMaximumItemsAdded(collection, element)) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    if (element !== document.activeElement) {
      this.range?.focusAtEnd();
    }

    this.collection = collection;
    this.externalTrigger = true;
    this.element = element;

    this.range?.insertText(this.collection.trigger);
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
      this.range?.replaceTriggerText(content, true, true, originalEvent, item);
    }
  }

  get isMentionLengthUnderMinimum() {
    if (!this.collection) return undefined;

    return this.mentionText.length < this.collection.menuShowMinLength;
  }
}

export default TributeContext;
