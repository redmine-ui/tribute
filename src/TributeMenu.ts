import { addHandler } from './helpers';
import type { Collection, Coordinate, ITribute, ITributeMenu, TributeItem } from './type';

class TributeMenu<T extends { disabled?: boolean }> implements ITributeMenu<T> {
  element: HTMLElement | null;
  selected: number;
  tribute: ITribute<T>;

  private ul?: HTMLElement;
  private remover?: () => void;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.element = null;
    this.selected = 0;
  }

  create(doc: Document, containerClass: string): HTMLElement {
    const wrapper = doc.createElement('div');
    this.ul = doc.createElement('ul');
    wrapper.className = containerClass;
    wrapper.appendChild(this.ul);

    this.element = this.tribute.menuContainer ? this.tribute.menuContainer.appendChild(wrapper) : doc.body.appendChild(wrapper);
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

  up(count: number) {
    if (this.element === null) return;
    //If menu.selected is -1 then there are no valid, non-disabled items
    //to navigate through
    if (this.selected === -1) {
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
    if (this.selected === -1) {
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

  setActiveLi(index?: number) {
    if (this.element === null) return;
    if (!this.tribute.current.collection) return;

    const selectClass = this.tribute.current.collection.selectClass;
    const lis = this.items;
    const _length = lis.length >>> 0;

    if (index) {
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

    if (!this.tribute.positionMenu) {
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
                                 visibility: hidden;
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
    if ((typeof collection.noMatchTemplate === 'function' && !collection.noMatchTemplate()) || !collection.noMatchTemplate) {
      this.tribute.hideMenu();
    } else {
      ul.innerHTML = typeof collection.noMatchTemplate === 'function' ? collection.noMatchTemplate() : collection.noMatchTemplate;

      return true;
    }
    return false;
  }

  _renderMenu(items: TributeItem<T>[], ul: HTMLElement, collection: Collection<T>) {
    ul.innerHTML = '';
    const doc = this.tribute.range.getDocument();
    const fragment = doc.createDocumentFragment();

    this.selected = items.findIndex((item) => item.original.disabled !== true);
    if (this.remover) {
      this.remover();
    }
    this.remover = addHandler(ul, 'mousemove', (e: Event) => {
      if (!(e.target instanceof HTMLElement)) return;
      if (!e.target.matches('li[data-index]')) return;

      const index = e.target.dataset.index;
      if ('movementY' in e && e.movementY !== 0 && index !== null && typeof index !== 'undefined') {
        this.setActiveLi(Number.parseInt(index, 10));
      }
    });

    items.forEach((item, index) => {
      const li = this._createMenuItem(item, collection, index, doc);
      fragment.appendChild(li);
    });
    ul.appendChild(fragment);

    return true;
  }

  _createMenuItem(item: TributeItem<T>, collection: Collection<T>, index: number, doc: Document) {
    const li = doc.createElement('li');
    li.setAttribute('data-index', index.toString());
    if (item.original.disabled) {
      li.setAttribute('data-disabled', 'true');
    }
    li.className = collection.itemClass;
    if (this.selected === index) {
      li.classList.add(collection.selectClass);
    }
    // remove all content in the li and append the content of menuItemTemplate
    const menuItemDomOrString = collection.menuItemTemplate !== null ? collection.menuItemTemplate(item, this.tribute) : '';
    if (menuItemDomOrString instanceof Element) {
      li.innerHTML = '';
      li.appendChild(menuItemDomOrString);
    } else {
      li.innerHTML = menuItemDomOrString;
    }
    return li;
  }
}

export default TributeMenu;
