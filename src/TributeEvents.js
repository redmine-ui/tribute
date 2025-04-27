import { addHandler } from './helpers.js';

class TributeEvents {
  constructor(tribute) {
    this.tribute = tribute;
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

    const key = getCode(event.key);
    const callback = this.callbacks[key];
    if (callback) {
      this.commandEvent = true;
      callback(event, element);
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

    if (!event.key || event.key === 'Escape') return;

    if (!this.tribute.allowSpaces && this.tribute.hasTrailingSpace) {
      this.tribute.hasTrailingSpace = false;
      this.commandEvent = true;
      this.callbacks.space(event, element);
      return;
    }

    if (!this.tribute.isActive) {
      if (this.tribute.autocompleteMode) {
        this.triggerChar(event, element, '');
      } else {
        const charCode = this.getTriggerCharCode();

        if (Number.isNaN(charCode) || !charCode) return;

        const trigger = this.tribute.triggers().find((trigger) => {
          return trigger.charCodeAt(0) === charCode;
        });

        if (typeof trigger !== 'undefined') {
          this.triggerChar(event, element, trigger);
        }
      }
    }

    if (this.tribute.current.isMentionLengthUnderMinimum) {
      this.tribute.hideMenu();
      return;
    }

    if (((this.tribute.current.trigger || this.tribute.autocompleteMode) && this.commandEvent === false) || event.key === 'Backspace') {
      this.tribute.showMenuFor(element, true);
    }
  }

  shouldDeactivate(event) {
    if (!this.tribute.isActive) return false;

    if (this.tribute.current.mentionText.length === 0) {
      let eventKeyPressed = false;
      const key = getCode(event.key);
      const callback = this.callbacks[key];
      if (callback) {
        eventKeyPressed = true;
      }

      return !eventKeyPressed;
    }

    return false;
  }

  getTriggerCharCode() {
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
      this.tribute.current.updateSelection(info);
    }
  }

  triggerChar(e, el, trigger) {
    const tribute = this.tribute;
    tribute.current.trigger = trigger;

    const collectionItem = tribute.collection.find((item) => {
      return item.trigger === trigger;
    });

    tribute.current.collection = collectionItem;

    if (!tribute.current.isMentionLengthUnderMinimum && tribute.inputEvent) {
      tribute.showMenuFor(el, true);
    }
  }

  get callbacks() {
    if (!this._callbacks) {
      this._callbacks = {
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
        arrowup: (e, el) => {
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
        arrowdown: (e, el) => {
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
        backspace: (e, el) => {
          if (this.tribute.isActive && this.tribute.current.mentionText.length < 1) {
            this.tribute.hideMenu();
          } else if (this.tribute.isActive) {
            this.tribute.showMenuFor(el);
          }
        },
      };
    }
    return this._callbacks;
  }
}

function getCode(key: string) {
  return key === ' ' ?  'space' : key.toLowerCase();
}

export default TributeEvents;
