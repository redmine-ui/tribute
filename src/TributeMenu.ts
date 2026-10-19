import { getItemClassName, renderMenuItem, resolveContent } from './collection';
import { addHandler, isDocumentFragment, isHTMLElement, renderInto } from './helpers';
import type { Collection, Coordinate, ITributeContext, ITributeMenu, StringOrElementTemplate, TributeItem } from './type';

class TributeMenu<T extends { disabled?: boolean }> implements ITributeMenu<T> {
  element: HTMLElement | null;

  /*
   * Index of the currently highlighted <li>.
   * -1 means "no selectable (non-disabled) item exists".
   * Mirrors the "not found" value of Array.prototype.findIndex
   */
  selected: number;
  readonly context: ITributeContext<T>;

  private ul?: HTMLElement;
  private remover?: () => void;

  constructor(context: ITributeContext<T>) {
    this.context = context;
    this.element = null;
    this.selected = 0;
  }

  create(containerClass: string): HTMLElement {
    const { h } = this.context.htmlHelper;
    this.ul = h('ul');
    this.element = h('div', { class: containerClass }, this.ul);
    return this.element;
  }

  activate() {
    this.selected = 0;
    window.setTimeout(() => {
      if (this.element === null) return;
      this.element.scrollTop = 0;
    }, 0);
  }

  deactivate() {
    if (this.element === null) return;

    this.element.style.cssText = 'display: none;';
    this.selected = 0;
  }

  unselect() {
    this.selected = -1;
  }

  get isActive() {
    return this.element !== null;
  }

  get items() {
    if (this.element === null) {
      // return empty nodeList
      return document.querySelectorAll<HTMLLIElement>(':not(*)');
    }

    return this.element.querySelectorAll('li');
  }

  get itemDisabled() {
    return this.items[this.selected]?.getAttribute('data-disabled') === 'true';
  }

  get hasEnabledItems() {
    return Array.from(this.items).some((el) => el.getAttribute('data-disabled') !== 'true');
  }

  up(count: number) {
    if (this.element === null) return;
    //If menu.selected is -1 then there are no valid, non-disabled items
    //to navigate through
    if (this.selected === -1 || !this.hasEnabledItems) {
      return;
    }

    do {
      this.selected--;
      if (this.selected === -1) {
        this.selected = count - 1;
        this.element.scrollTop = this.element.scrollHeight;
      }
    } while (this.itemDisabled);
    this.setActiveLi();
  }

  down(count: number) {
    if (this.element === null) return;
    //If menu.selected is -1 then there are no valid, non-disabled items
    //to navigate through
    if (this.selected === -1 || !this.hasEnabledItems) {
      return;
    }

    do {
      this.selected++;
      if (this.selected >= count) {
        this.selected = 0;
        this.element.scrollTop = 0;
      }
    } while (this.itemDisabled);
    this.setActiveLi();
  }

  showLoading(template: StringOrElementTemplate<T>): boolean {
    if (!this.ul) throw new Error('menu do not have "ul" element');

    const content = resolveContent(this.context.tribute, template, this.context.htmlHelper);
    if (content !== null) {
      renderInto(this.ul, content);
      return true;
    }
    return false;
  }

  setActiveLi(index?: number) {
    if (this.element === null) return;
    if (!this.context.collection) return;
    if (index !== undefined && this.items[index]?.getAttribute('data-disabled') === 'true') return;

    const selectClass = this.context.collection.selectClass;
    const lis = this.items;
    const _length = lis.length >>> 0;

    if (index !== undefined) {
      this.selected = index;
    }
    const element = this.element;
    this.items.forEach((li, i) => {
      if (i === this.selected) {
        if (li.getAttribute('data-disabled') !== 'true') {
          li.classList.add(selectClass);
        }

        const liClientRect = li.getBoundingClientRect();
        const menuClientRect = element.getBoundingClientRect();

        if (liClientRect.bottom > menuClientRect.bottom) {
          const scrollDistance = liClientRect.bottom - menuClientRect.bottom;
          element.scrollTop += scrollDistance;
        } else if (liClientRect.top < menuClientRect.top) {
          const scrollDistance = menuClientRect.top - liClientRect.top;
          element.scrollTop -= scrollDistance;
        }
      } else {
        li.classList.remove(selectClass);
      }
    });
  }

  positionAtCaret(info: unknown, coordinates: Coordinate) {
    if (this.element === null) return;

    if (typeof info === 'undefined') {
      this.element.style.cssText = 'display: none';
      return;
    }

    if (!this.context.tribute.positionMenu) {
      this.element.style.cssText = 'display: block;';
      return;
    }

    this.element.style.cssText = `top: ${coordinates.top}px;
                                   left: ${coordinates.left}px;
                                   right: ${coordinates.right}px;
                                   bottom: ${coordinates.bottom}px;
                                   max-height: ${coordinates.maxHeight || 500}px;
                                   max-width: ${coordinates.maxWidth || 300}px;
                                   position: ${coordinates.position || 'absolute'};
                                   display: block;`;

    if (coordinates.left === 'auto') {
      this.element.style.left = 'auto';
    }

    if (coordinates.top === 'auto') {
      this.element.style.top = 'auto';
    }
  }

  getDimensions() {
    // Width of the menu depends of its contents and position
    // We must check what its width would be without any obstruction
    // This way, we can achieve good positioning for flipping the menu
    const dimensions: {
      width: number | null;
      height: number | null;
    } = {
      width: null,
      height: null,
    };
    if (this.element === null) {
      return dimensions;
    }

    this.element.style.cssText = `top: 0px;
                                 left: 0px;
                                 position: fixed;
                                 display: block;
                                 visibility; hidden;
                                 max-height:500px;`;
    dimensions.width = this.element.offsetWidth;
    dimensions.height = this.element.offsetHeight;

    this.element.style.cssText = 'display: none;';

    return dimensions;
  }

  render(items: TributeItem<T>[], collection: Collection<T>) {
    if (this.ul === undefined) return false;
    if (!items.length) {
      return this._handleNoItem(this.ul, collection);
    } else {
      return this._renderMenu(items, this.ul, collection);
    }
  }

  _handleNoItem(ul: HTMLElement, collection: Collection<T>) {
    if (!this.element) return false;

    const noMatchEvent = new CustomEvent('tribute-no-match', {
      detail: this.element,
    });
    this.element.dispatchEvent(noMatchEvent);

    const content = resolveContent(this.context.tribute, collection.noMatchTemplate, this.context.htmlHelper);
    if (content === null) {
      this.context.hideMenu();
      return false;
    }
    renderInto(ul, content);
    return true;
  }

  _renderMenu(items: TributeItem<T>[], ul: HTMLElement, collection: Collection<T>) {
    ul.replaceChildren();

    this.selected = items.findIndex((item) => item.original.disabled !== true);
    if (this.remover) {
      this.remover();
    }
    this.remover = addHandler(ul, 'mousemove', (e: Event) => {
      if (!isHTMLElement(e.target)) return;
      if (!e.target.matches('li[data-index]')) return;

      const index = e.target.dataset.index;
      if ('movementY' in e && e.movementY !== 0 && index !== null && typeof index !== 'undefined') {
        this.setActiveLi(Number.parseInt(index, 10));
      }
    });

    const childern = items.map((item, index) => {
      return this._createMenuItem(item, collection, index);
    });
    ul.append(...childern);

    return true;
  }

  _createMenuItem(item: TributeItem<T>, collection: Collection<T>, index: number) {
    const { h } = this.context.htmlHelper;
    const li = h('li', {
      class: getItemClassName(collection, this.selected === index),
      'data-index': index.toString(),
      'data-disabled': item.original.disabled ? 'true' : undefined,
    });

    // remove all content in the li and append the content of menuItemTemplate
    const menuItemDomOrString = renderMenuItem(collection, item, this.context.tribute, this.context.htmlHelper);
    if (isHTMLElement(menuItemDomOrString) || isDocumentFragment(menuItemDomOrString)) {
      li.replaceChildren();
      li.appendChild(menuItemDomOrString);
    } else {
      li.innerHTML = menuItemDomOrString;
    }
    return li;
  }
}

export default TributeMenu;
