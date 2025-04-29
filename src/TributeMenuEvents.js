import { addHandler } from './helpers.js';

class TributeMenuEvents {
  constructor(tribute) {
    this.tribute = tribute;
  }

  bind(menu) {
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

    this.removers = [
      addHandler(this.tribute.range.getDocument(), 'mousedown', (event) => this.click(event), false),
      addHandler(window, 'resize', windowResizeEvent),
    ];

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

  unbind(menu) {
    for (const remover of this.removers) {
      remover();
    }
  }

  click(event) {
    const element = event.currentTarget;
    const tribute = this.tribute;
    if (tribute.menu.element.contains(event.target)) {
      let li = event.target;
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

      if (!li) {
        return;
      }

      if (li.getAttribute('data-disabled') === 'true') {
        return;
      }
      if (tribute.current.filteredItems.length === 0) li.setAttribute('data-index', -1);

      tribute.selectItemAtIndex(li.getAttribute('data-index'), event);
      tribute.hideMenu();

      // TODO: should fire with externalTrigger and target is outside of menu
    } else if (tribute.current.externalTrigger) {
      tribute.current.externalTrigger = false;
    } else if (tribute.current.element && !tribute.current.externalTrigger) {
      setTimeout(() => tribute.hideMenu());
    }
  }

  debounce(func, wait, immediate, ...args) {
    let timeout;
    return () => {
      const context = this;
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }
}

export default TributeMenuEvents;
