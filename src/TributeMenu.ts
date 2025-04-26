import type { Coordinate, ITribute, ITributeMenu } from './type';

class TributeMenu<T extends {}> implements ITributeMenu<T> {
  element: HTMLElement | null;
  selected: number;
  tribute: ITribute<T>;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.element = null;
    this.selected = 0;
  }

  create(doc: Document, containerClass: string): HTMLElement {
    const wrapper = doc.createElement('div');
    const ul = doc.createElement('ul');
    wrapper.className = containerClass;
    wrapper.appendChild(ul);

    this.element = this.tribute.menuContainer ? this.tribute.menuContainer.appendChild(wrapper) : doc.body.appendChild(wrapper);
    return this.element;
  }

  activate() {
    this.selected = 0;
    window.setTimeout(() => {
      if (this.element === null) throw new Error('the menu element is null!');
      this.element.scrollTop = 0;
    }, 0);
  }

  deactivate() {
    if (this.element === null) throw new Error('the menu element is null!');

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
    if (this.element === null) throw new Error('the menu element is null!');

    return this.element.querySelectorAll('li');
  }

  get itemDisabled() {
    return this.items[this.selected]?.getAttribute('data-disabled') === 'true';
  }

  up(count: number) {
    if (this.element === null) throw new Error('the menu element is null!');
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
    if (this.element === null) throw new Error('the menu element is null!');
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
    if (this.element === null) throw new Error('the menu element is null!');
    if (!this.tribute.current.collection) return;

    const selectClass = this.tribute.current.collection.selectClass;
    const lis = this.items;
    const length = lis.length >>> 0;

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
    if (this.element === null) throw new Error('the menu element is null!');

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
    if (this.element === null) throw new Error('the menu element is null!');
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
}

export default TributeMenu;
