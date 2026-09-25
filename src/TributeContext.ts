import { isAsync, isMaximumItemsAdded, query } from './collection';
import type { Collection, ITribute, ITributeContext, ITributeMenu, ITributeRange, TributeItem, TriggerInfo } from './type';

type ContextArguments<T extends {}> = { tribute: ITribute<T>; element: HTMLElement; range: ITributeRange<T>; menu: ITributeMenu<T> };

type SessionBase<T extends {}> = {
  trigger: string;
  collection: Collection<T>;
  externalTrigger: boolean;
};

type SessionState<T extends {}> =
  | { kind: 'idle'; mentionText: string }
  | ({ kind: 'triggered'; mentionText: string } & SessionBase<T>)
  | ({ kind: 'searching'; mentionText: string; filteredItems?: TributeItem<T>[] } & SessionBase<T>);

class TributeContext<T extends {}> implements ITributeContext<T> {
  readonly tribute: ITribute<T>;
  readonly element: HTMLElement;
  readonly range: ITributeRange<T>;
  readonly menu: ITributeMenu<T>;
  private state: SessionState<T>;
  #isActive = false;

  constructor({ tribute, element, range, menu }: ContextArguments<T>) {
    this.tribute = tribute;
    this.element = element;
    this.range = range;
    this.menu = menu;
    this.state = { kind: 'idle', mentionText: '' };
  }

  get mentionText() {
    return this.state.mentionText;
  }

  get collection() {
    return this.state.kind === 'idle' ? undefined : this.state.collection;
  }

  get trigger() {
    return this.state.kind === 'idle' ? undefined : this.state.trigger;
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
    this.state = {
      kind: 'idle',
      mentionText: this.state.mentionText,
    };
  }

  sessionStarted(trigger?: string) {
    if (typeof trigger === 'undefined') return;

    const collection = this.tribute.collection.find((item) => {
      return item.trigger === trigger;
    });

    if (collection === undefined) return;

    this.state = {
      ...this.state,
      kind: 'triggered',
      trigger: trigger,
      collection: collection,
      externalTrigger: false,
    };
  }

  queryChanged(info?: TriggerInfo) {
    if (info) {
      this.state.mentionText = info.mentionText || '';
    }
  }

  refreshMenu(hotkeyHandledOnKeydown: boolean, showMenuOnBackspace: boolean) {
    if (this.state.kind === 'idle') return;

    if (this.isMentionLengthUnderMinimum) {
      this.tribute.hideMenu();
      return;
    }

    if (((this.state.trigger || this.tribute.autocompleteMode) && !hotkeyHandledOnKeydown) || showMenuOnBackspace) {
      this.tribute.showMenuFor(this.element, true);
    }
  }

  selectionMoved(direction: 1 | -1): boolean {
    if (this.state.kind !== 'searching') return false;

    if (this.isActive && this.state.filteredItems) {
      const count = this.state.filteredItems.length;

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
    if (this.state.kind !== 'searching') return false;

    if (index !== undefined) {
      if (index !== null) {
        this.selectItemAtIndex(index, e);
      }
      this.tribute.hideMenu();
      return true;
    }
    const filteredItems = this.state.filteredItems;
    if (this.isActive && filteredItems?.length !== undefined) {
      if (filteredItems.length === 0) {
        this.menu.unselect();
      }

      setTimeout(() => {
        this.selectItemAt(this.menu.selected, e);
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
    if (this.state.kind === 'idle') return false;

    if (this.state.externalTrigger) {
      this.state.externalTrigger = false;
      return true;
    }
    return false;
  }

  get hasFilteredItems(): boolean {
    if (this.state.kind !== 'searching') return false;

    return !!this.state.filteredItems && this.state.filteredItems.length > 0;
  }

  private process(scrollTo: boolean) {
    if (this.menu.element === null || this.state.kind === 'idle') return;

    const ul = this.menu.element.querySelector('ul');
    if (ul === null) throw new Error('menu do not have "ul" element');

    if (isAsync(this.state.collection) && this.state.collection.loadingItemTemplate) {
      ul.innerHTML = this.state.collection.loadingItemTemplate;
      this.range.positionMenuAtCaret(scrollTo);
    }

    query(this.state.collection, this.tribute.search, this.state.mentionText, (items) => {
      if (!this.isActive || this.state.kind === 'idle') return;

      this.state = {
        ...this.state,
        kind: 'searching',
        filteredItems: items,
      };

      const scroll = this.menu.render(items, this.state.collection);
      if (scroll === true && scrollTo === true) {
        this.range.positionMenuAtCaret(scrollTo);
      }
    });
  }

  showMenuFor(element: HTMLElement, scrollTo: boolean | undefined, bindMenu: (menu: HTMLElement) => void) {
    if (this.state.kind === 'idle') return;

    // Check for maximum number of items added to the input for the specific Collection
    if (isMaximumItemsAdded(this.state.collection, element)) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    // create the menu if it doesn't exist.
    if (!this.menu.element) {
      const menu = this.menu.create(this.range.getDocument(), this.state.collection.containerClass);
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

    this.range.focusAtEnd();
    this.state = {
      ...this.state,
      kind: 'searching',
      collection: collection,
      trigger: collection.trigger,
      externalTrigger: true,
    };
    this.range.insertText(collection.trigger);
  }

  private selectItemAtIndex(index: string, originalEvent: Event): void {
    const _index = Number.parseInt(index, 10);
    this.selectItemAt(_index, originalEvent);
  }

  private selectItemAt(_index: number, originalEvent: Event) {
    if (this.state.kind !== 'searching' || Number.isNaN(_index) || !this.state.filteredItems) return;

    if (this.state.collection.selectTemplate === null) return;

    const item = this.state.filteredItems[_index];
    const content = this.state.collection.selectTemplate(item, this.tribute);

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
    if (this.state.kind === 'idle') return undefined;

    return this.state.mentionText.length < this.state.collection.menuShowMinLength;
  }
}

export default TributeContext;
