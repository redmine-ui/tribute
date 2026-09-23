import { isAsync, isMaximumItemsAdded, query } from './collection';
import type { Collection, ITribute, ITributeContext, ITributeMenu, ITributeRange, TributeItem, TriggerInfo } from './type';

type ContextArguments<T extends {}> = { tribute: ITribute<T>; element: HTMLElement; range: ITributeRange<T>; menu: ITributeMenu<T> };

class TributeContext<T extends {}> implements ITributeContext<T> {
  readonly tribute: ITribute<T>;
  readonly element: HTMLElement;
  readonly range: ITributeRange<T>;
  readonly menu: ITributeMenu<T>;

  #isActive = false;
  private filteredItems?: TributeItem<T>[];
  collection?: Collection<T>;
  mentionText: string;
  externalTrigger: boolean;
  selectedPath?: (number | undefined)[];
  selectedOffset?: number;
  trigger?: string;

  constructor({ tribute, element, range, menu }: ContextArguments<T>) {
    this.tribute = tribute;
    this.element = element;
    this.range = range;
    this.menu = menu;

    this.mentionText = '';
    this.externalTrigger = false;
  }

  private setActive(value: boolean) {
    if (this.#isActive !== value) {
      this.#isActive = value;
      const activeEvent = new CustomEvent(`tribute-active-${value}`);
      this.element.dispatchEvent(activeEvent);
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

  sessionStarted(trigger?: string) {
    if (typeof trigger === 'undefined') return;

    this.trigger = trigger;

    this.collection = this.tribute.collection.find((item) => {
      return item.trigger === trigger;
    });
  }

  queryChanged(info?: TriggerInfo) {
    if (info) {
      this.selectedPath = info.mentionSelectedPath;
      this.mentionText = info.mentionText || '';
      this.selectedOffset = info.mentionSelectedOffset;
    }
  }

  refreshMenu(hotkeyHandledOnKeydown: boolean, showMenuOnBackspace: boolean) {
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
        this.menu.up(count);
      } else {
        this.menu.down(count);
      }

      return true;
    }
    return false;
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
        this.menu.unselect();
      }

      setTimeout(() => {
        this.selectItemAtIndex(this.menu.selected.toString(), e);
        this.tribute.hideMenu();
      }, 0);
      return true;
    }
    return false;
  }

  sessionCanceled(): boolean {
    if (this.isActive) {
      this.tribute.hideMenu();
      return true;
    }
    return false;
  }

  consumeExternalTrigger(): boolean {
    if (this.externalTrigger) {
      this.externalTrigger = false;
      return true;
    }
    return false;
  }

  get hasFilteredItems(): boolean {
    return !!this.filteredItems && this.filteredItems.length > 0;
  }

  private process(scrollTo: boolean) {
    if (this.menu.element === null || !this.collection) return;

    const ul = this.menu.element.querySelector('ul');
    if (ul === null) throw new Error('menu do not have "ul" element');

    if (isAsync(this.collection) && this.collection.loadingItemTemplate) {
      ul.innerHTML = this.collection.loadingItemTemplate;
      this.range.positionMenuAtCaret(scrollTo);
    }

    query(this.collection, this.tribute.search, this.mentionText, (items) => {
      if (!this.isActive || !this.collection) return;

      this.filteredItems = items;

      const scroll = this.menu.render(items, this.collection);
      if (scroll === true && scrollTo === true) {
        this.range.positionMenuAtCaret(scrollTo);
      }
    });
  }

  showMenuFor(element: HTMLElement, scrollTo: boolean | undefined, bindMenu: (menu: HTMLElement) => void) {
    if (this.collection === undefined) return;

    // Check for maximum number of items added to the input for the specific Collection
    if (isMaximumItemsAdded(this.collection, element)) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    // create the menu if it doesn't exist.
    if (!this.menu.element) {
      const menu = this.menu.create(this.range.getDocument(), this.collection.containerClass);
      bindMenu(menu);
    }

    this.activate();
    this.menu.activate();
    this.process(!!scrollTo);
  }

  showMenuForCollection(collection?: Collection<T>): void {
    if (typeof collection === 'undefined' || isMaximumItemsAdded(collection, this.element)) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    if (this.element !== document.activeElement) {
      this.range.focusAtEnd();
    }

    this.collection = collection;
    this.externalTrigger = true;

    this.range.insertText(this.collection.trigger);
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
      this.range.replaceTriggerText(content, true, true, originalEvent, item);
    }
  }

  get isMentionLengthUnderMinimum() {
    if (!this.collection) return undefined;

    return this.mentionText.length < this.collection.menuShowMinLength;
  }
}

export default TributeContext;
