import { addHandler, debounce, isHTMLElement } from './helpers';
import type { ITribute, ITributeContext } from './type';

class TributeMenuEvents<T extends {}> {
  removersMap: WeakMap<ITributeContext<T>, (() => void)[]>;
  tribute: ITribute<T>;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.removersMap = new WeakMap();
  }

  bind(context: ITributeContext<T>) {
    if (this.removersMap.has(context)) return;

    const menuContainerScrollEvent = debounce(() => {
      if (context.isActive && context.element) {
        this.tribute.showMenuFor(context.element, false);
      }
    }, 10);
    const hideMenu = debounce(() => {
      if (context.isActive) {
        context.hideMenu();
      }
    }, 10);

    const removers: (() => void)[] = [];
    const doc = context.range.getDocument();
    const win = context.range.getWindow();

    removers.push(addHandler(doc, 'mousedown', (event: Event) => this.click(context, event), false));
    removers.push(addHandler(win, 'resize', hideMenu));

    if (this.tribute.closeOnScroll === true) {
      removers.push(addHandler(win, 'scroll', hideMenu));
    } else if (this.tribute.closeOnScroll !== false) {
      removers.push(addHandler(this.tribute.closeOnScroll, 'scroll', hideMenu, false));
    } else {
      if (this.tribute.menuContainer) {
        removers.push(addHandler(this.tribute.menuContainer, 'scroll', menuContainerScrollEvent, false));
      } else {
        removers.push(addHandler(win, 'scroll', menuContainerScrollEvent));
      }
    }
    this.removersMap.set(context, removers);
  }

  unbind(context: ITributeContext<T>) {
    const removers = this.removersMap.get(context);
    if (removers) {
      for (const remover of removers) {
        remover();
      }
      this.removersMap.delete(context);
    }
  }

  click(context: ITributeContext<T>, event: Event) {
    const element = event.target;
    if (!isHTMLElement(element)) return;

    if (context.menu.element?.contains(element)) {
      event.preventDefault();
      event.stopPropagation();

      const li = element.closest('li');
      if (!isHTMLElement(li) || li.getAttribute('data-disabled') === 'true') return;

      if (!context.hasFilteredItems) {
        li.setAttribute('data-index', '-1');
      }

      const index = li.getAttribute('data-index');
      context.selectionConfirmed(event, index);

      // TODO: should fire with externalTrigger and target is outside of menu
    } else if (!context.consumeExternalTrigger()) {
      setTimeout(() => context.hideMenu());
    }
  }
}

export default TributeMenuEvents;
