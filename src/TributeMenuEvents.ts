import { addHandler, debounce } from './helpers';
import type { ITribute } from './type';

class TributeMenuEvents<T extends {}> {
  removersMap: WeakMap<EventTarget, (() => void)[]>;
  tribute: ITribute<T>;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.removersMap = new WeakMap();
  }

  bind(menu: EventTarget) {
    const menuContainerScrollEvent = debounce(
      () => {
        if (this.tribute.isActive && this.tribute.current?.element) {
          this.tribute.showMenuFor(this.tribute.current?.element, false);
        }
      },
      10,
      false
    );
    const hideMenu = debounce(
      () => {
        if (this.tribute.isActive) {
          this.tribute.hideMenu();
        }
      },
      10,
      false,
    );

    const removers: (() => void)[] = []
    const doc = this.tribute.current?.range.getDocument();
    if (doc) {
      removers.push(addHandler(doc, 'mousedown', (event: Event) => this.click(event), false));
    }
    removers.push(addHandler(window, 'resize', hideMenu));

    if (this.tribute.closeOnScroll === true) {
      removers.push(addHandler(window, 'scroll', hideMenu));
    } else if (this.tribute.closeOnScroll !== false) {
      removers.push(addHandler(this.tribute.closeOnScroll, 'scroll', hideMenu, false));
    } else {
      if (this.tribute.menuContainer) {
        removers.push(addHandler(this.tribute.menuContainer, 'scroll', menuContainerScrollEvent, false));
      } else {
        removers.push(addHandler(window, 'scroll', menuContainerScrollEvent));
      }
    }
    this.removersMap.set(menu, removers);
  }

  unbind(menu: EventTarget) {
    const removers = this.removersMap.get(menu);
    if (removers) {
      for (const remover of removers) {
        remover();
      }
      this.removersMap.delete(menu);
    }
  }

  click(event: Event) {
    const element = event.target;
    const tribute = this.tribute;
    if (!(element instanceof HTMLElement)) return;

    if (tribute.current?.menu.element?.contains(element)) {
      event.preventDefault();
      event.stopPropagation();

      const li = element.closest('li');
      if (!(li instanceof HTMLElement) || li.getAttribute('data-disabled') === 'true') return;

      if (!tribute.current?.hasFilteredItems) {
        li.setAttribute('data-index', '-1');
      }

      const index = li.getAttribute('data-index');
      tribute.current?.selectionConfirmed(event, index);

      // TODO: should fire with externalTrigger and target is outside of menu
    } else if (!tribute.current?.consumeExternalTrigger()) {
      setTimeout(() => tribute.hideMenu());
    }
  }
}

export default TributeMenuEvents;
