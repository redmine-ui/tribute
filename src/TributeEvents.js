import { addHandler } from './helpers.js';

class TributeEvents {
  constructor(tribute) {
    this.tribute = tribute;
    this.tribute.events = this;
  }

  static keys() {
    return [
      {
        key: 9,
        value: 'TAB',
      },
      {
        key: 8,
        value: 'DELETE',
      },
      {
        key: 13,
        value: 'ENTER',
      },
      {
        key: 27,
        value: 'ESCAPE',
      },
      {
        key: 32,
        value: 'SPACE',
      },
      {
        key: 38,
        value: 'UP',
      },
      {
        key: 40,
        value: 'DOWN',
      },
    ];
  }

  bind(element) {
    this.removers = [
      addHandler(element, 'keydown', (event) => {
        this.keydown(event);
      }),
      addHandler(element, 'keyup', (event) => {
        this.keyup(event);
      }),
      addHandler(element, 'input', (event) => {
        this.input(event);
      }),
    ];
  }

  unbind(element) {
    for (const remover of this.removers) {
      remover();
    }
  }

  keydown(event) {
    const element = event.currentTarget;
    if (this.shouldDeactivate(event)) {
      this.tribute.isActive = false;
      this.tribute.hideMenu();
    }
    this.commandEvent = false;

    for (const o of TributeEvents.keys()) {
      if (o.key === event.keyCode) {
        this.commandEvent = true;
        this.callbacks()[o.value.toLowerCase()](event, element);
      }
    }
  }

  input(event) {
    const element = event.currentTarget;
    this.inputEvent = true;
    this.keyup(event);
  }

  keyup(event) {
    const element = event.currentTarget;
    if (this.inputEvent) {
      this.inputEvent = false;
    }
    this.updateSelection(element);

    if (!event.keyCode || event.keyCode === 27) return;

    if (!this.tribute.allowSpaces && this.tribute.hasTrailingSpace) {
      this.tribute.hasTrailingSpace = false;
      this.commandEvent = true;
      this.callbacks().space(event, element);
      return;
    }

    if (!this.tribute.isActive) {
      if (this.tribute.autocompleteMode) {
        this.callbacks().triggerChar(event, element, '');
      } else {
        const keyCode = this.getKeyCode(element, event);

        if (Number.isNaN(keyCode) || !keyCode) return;

        const trigger = this.tribute.triggers().find((trigger) => {
          return trigger.charCodeAt(0) === keyCode;
        });

        if (typeof trigger !== 'undefined') {
          this.callbacks().triggerChar(event, element, trigger);
        }
      }
    }

    if (this.tribute.current.mentionText.length < this.tribute.current.collection.menuShowMinLength) {
      this.tribute.hideMenu();
      return;
    }

    if (((this.tribute.current.trigger || this.tribute.autocompleteMode) && this.commandEvent === false) || event.keyCode === 8) {
      this.tribute.showMenuFor(element, true);
    }
  }

  shouldDeactivate(event) {
    if (!this.tribute.isActive) return false;

    if (this.tribute.current.mentionText.length === 0) {
      let eventKeyPressed = false;
      for (const o of TributeEvents.keys()) {
        if (event.keyCode === o.key) {
          eventKeyPressed = true;
        }
      }

      return !eventKeyPressed;
    }

    return false;
  }

  getKeyCode(el, event) {
    let char;
    const tribute = this.tribute;
    const info = tribute.range.getTriggerInfo(false, tribute.hasTrailingSpace, true, tribute.allowSpaces, tribute.autocompleteMode);

    if (info) {
      return info.mentionTriggerChar.charCodeAt(0);
    }
    return false;
  }

  updateSelection(el) {
    this.tribute.current.element = el;
    const info = this.tribute.range.getTriggerInfo(false, this.tribute.hasTrailingSpace, true, this.tribute.allowSpaces, this.tribute.autocompleteMode);

    if (info) {
      this.tribute.current.selectedPath = info.mentionSelectedPath;
      this.tribute.current.mentionText = info.mentionText;
      this.tribute.current.selectedOffset = info.mentionSelectedOffset;
    }
  }

  callbacks() {
    return {
      triggerChar: (e, el, trigger) => {
        const tribute = this.tribute;
        tribute.current.trigger = trigger;

        const collectionItem = tribute.collection.find((item) => {
          return item.trigger === trigger;
        });

        tribute.current.collection = collectionItem;

        if (tribute.current.mentionText.length >= tribute.current.collection.menuShowMinLength && tribute.inputEvent) {
          tribute.showMenuFor(el, true);
        }
      },
      enter: (e, el) => {
        // choose selection
        const filteredItems = this.tribute.current.filteredItems;
        if (this.tribute.isActive && filteredItems && filteredItems.length) {
          e.preventDefault();
          e.stopPropagation();

          if (this.tribute.current.filteredItems.length === 0) this.tribute.menuSelected = -1;

          setTimeout(() => {
            this.tribute.selectItemAtIndex(this.tribute.menuSelected, e);
            this.tribute.hideMenu();
          }, 0);
        }
      },
      escape: (e, el) => {
        if (this.tribute.isActive) {
          e.preventDefault();
          e.stopPropagation();
          this.tribute.isActive = false;
          this.tribute.hideMenu();
        }
      },
      tab: (e, el) => {
        // choose first match
        this.callbacks().enter(e, el);
      },
      space: (e, el) => {
        if (this.tribute.isActive) {
          if (this.tribute.spaceSelectsMatch) {
            this.callbacks().enter(e, el);
          } else if (!this.tribute.allowSpaces) {
            e.stopPropagation();
            setTimeout(() => {
              this.tribute.hideMenu();
              this.tribute.isActive = false;
            }, 0);
          }
        }
      },
      up: (e, el) => {
        // navigate up ul
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          const count = this.tribute.current.filteredItems.length;
          const lis = this.tribute.menu.querySelectorAll('li');

          //If menuSelected is -1 then there are no valid, non-disabled items
          //to navigate through
          if (this.tribute.menuSelected === -1) {
            return;
          }

          do {
            this.tribute.menuSelected--;
            if (this.tribute.menuSelected === -1) {
              this.tribute.menuSelected = count - 1;
              this.tribute.menu.scrollTop = this.tribute.menu.scrollHeight;
            }
          } while (lis[this.tribute.menuSelected].getAttribute('data-disabled') === 'true');
          this.setActiveLi();
        }
      },
      down: (e, el) => {
        // navigate down ul
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          const count = this.tribute.current.filteredItems.length;
          const lis = this.tribute.menu.querySelectorAll('li');

          //If menuSelected is -1 then there are no valid, non-disabled items
          //to navigate through
          if (this.tribute.menuSelected === -1) {
            return;
          }

          do {
            this.tribute.menuSelected++;
            if (this.tribute.menuSelected >= count) {
              this.tribute.menuSelected = 0;
              this.tribute.menu.scrollTop = 0;
            }
          } while (lis[this.tribute.menuSelected].getAttribute('data-disabled') === 'true');
          this.setActiveLi();
        }
      },
      delete: (e, el) => {
        if (this.tribute.isActive && this.tribute.current.mentionText.length < 1) {
          this.tribute.hideMenu();
        } else if (this.tribute.isActive) {
          this.tribute.showMenuFor(el);
        }
      },
    };
  }

  setActiveLi(index) {
    const lis = this.tribute.menu.querySelectorAll('li');
    const length = lis.length >>> 0;

    if (index) this.tribute.menuSelected = Number.parseInt(index);

    for (let i = 0; i < length; i++) {
      const li = lis[i];
      if (i === this.tribute.menuSelected) {
        if (li.getAttribute('data-disabled') !== 'true') {
          li.classList.add(this.tribute.current.collection.selectClass);
        }

        const liClientRect = li.getBoundingClientRect();
        const menuClientRect = this.tribute.menu.getBoundingClientRect();

        if (liClientRect.bottom > menuClientRect.bottom) {
          const scrollDistance = liClientRect.bottom - menuClientRect.bottom;
          this.tribute.menu.scrollTop += scrollDistance;
        } else if (liClientRect.top < menuClientRect.top) {
          const scrollDistance = menuClientRect.top - liClientRect.top;
          this.tribute.menu.scrollTop -= scrollDistance;
        }
      } else {
        li.classList.remove(this.tribute.current.collection.selectClass);
      }
    }
  }

  getFullHeight(elem, includeMargin) {
    const height = elem.getBoundingClientRect().height;

    if (includeMargin) {
      const style = elem.currentStyle || window.getComputedStyle(elem);
      return height + Number.parseFloat(style.marginTop) + Number.parseFloat(style.marginBottom);
    }

    return height;
  }
}

export default TributeEvents;
