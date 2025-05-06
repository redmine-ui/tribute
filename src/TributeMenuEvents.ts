import { addHandler } from './helpers';
import type { ITribute } from './type';

class TributeMenuEvents<T extends {}> {
  removers: (() => void)[];
  tribute: ITribute<T>;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.removers = [];
  }

  bind(menu: EventTarget) {
    const menuContainerScrollEvent = this.debounce(
      () => {
        if (this.tribute.isActive) {
          this.tribute.hideMenu();
        }
      },
      10,
      false,
    );
    const windowResizeEvent = this.debounce(
      () => {
        if (this.tribute.isActive) {
          this.tribute.hideMenu();
        }
      },
      10,
      false,
    );
    const closeOnScrollEvent = this.debounce(
      () => {
        if (this.tribute.isActive) {
          this.tribute.hideMenu();
        }
      },
      10,
      false,
    );

    this.removers.push(addHandler(this.tribute.range.getDocument(), 'mousedown', (event: Event) => this.click(event), false));
    this.removers.push(addHandler(window, 'resize', windowResizeEvent));

    if (this.tribute.closeOnScroll === true) {
      this.removers.push(addHandler(window, 'scroll', closeOnScrollEvent));
    } else if (this.tribute.closeOnScroll !== false) {
      this.removers.push(addHandler(this.tribute.closeOnScroll, 'scroll', closeOnScrollEvent, false));
    } else {
      if (this.tribute.menuContainer) {
        this.removers.push(addHandler(this.tribute.menuContainer, 'scroll', menuContainerScrollEvent, false));
      } else {
        this.removers.push(addHandler(window, 'scroll', menuContainerScrollEvent));
      }
    }
  }

  unbind(menu: EventTarget) {
    for (const remover of this.removers) {
      remover();
    }
  }

  click(event: Event) {
    const element = event.target;
    const tribute = this.tribute;
    if (!tribute.current || !(element instanceof Node)) return;

    if (tribute.menu.element?.contains(element)) {
      let li: Node | undefined | null = element;
      event.preventDefault();
      event.stopPropagation();
      while (li.nodeName.toLowerCase() !== 'li') {
        li = li.parentNode;
        if (!li || li === tribute.menu.element) {
          // When li === tribute.menu, it's either a click on the entire component or on the scrollbar (if visible)
          li = undefined;
          break;
        }
      }

      if (!(li instanceof HTMLElement)) return;

      if (li.getAttribute('data-disabled') === 'true') {
        return;
      }
      if (tribute.current.filteredItems?.length === 0) {
        li.setAttribute('data-index', '-1');
      }

      const index = li.getAttribute('data-index');
      if (index !== null) {
        tribute.selectItemAtIndex(index, event);
      }
      tribute.hideMenu();

      // TODO: should fire with externalTrigger and target is outside of menu
    } else if (tribute.current.externalTrigger) {
      tribute.current.externalTrigger = false;
    } else if (tribute.current.element && !tribute.current.externalTrigger) {
      setTimeout(() => tribute.hideMenu());
    }
  }

  debounce<F extends (...args: unknown[]) => unknown>(func: F, wait: number, immediate: boolean, ...args: Parameters<F>) {
    let timeout: ReturnType<typeof setTimeout> | null;
    return () => {
      const context = this;
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      const callNow = immediate && !timeout;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }
}

export default TributeMenuEvents;
