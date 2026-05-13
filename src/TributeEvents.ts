import { addHandler, isTextAreaOrInput } from './helpers';
import type { ITribute } from './type';

const hotkeys = ['tab', 'backspace', 'enter', 'escape', 'space', 'arrowup', 'arrowdown'] as const;
type hotkeyType = (typeof hotkeys)[number];

class TributeEvents<T extends {}> {
  removers: (() => void)[];
  tribute: ITribute<T>;
  inputEvent: boolean;
  commandEvent?: boolean;
  compositionFilter: CompositionFilter;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
    this.removers = [];
    this.inputEvent = false;
    this.compositionFilter = new CompositionFilter();
  }

  bind(element: EventTarget) {
    this.removers.push(
      addHandler(element, 'compositionstart', (event: Event) => {
        this.compositionFilter.compositionstart(event);
      }),
      addHandler(element, 'compositionend', (event: Event) => {
        this.compositionFilter.compositionend(event);
      }),
      addHandler(element, 'keydown', (event: Event) => {
        this.compositionFilter.keydown(event);
      }),
      addHandler(element, 'keydown', (event: Event) => {
        this.keydown(event);
      }),
      addHandler(element, 'keyup', (event: Event) => {
        this.keyup(event);
      }),
      addHandler(element, 'input', (event: Event) => {
        this.compositionFilter.input(event);
      }),
      addHandler(element, 'input', (event: Event) => {
        this.input(event);
      }),
    );
  }

  unbind(_element: EventTarget) {
    for (const remover of this.removers) {
      remover();
    }
  }

  keydown(event: Event) {
    if (!(event instanceof KeyboardEvent)) return;

    const element = event.currentTarget;
    if (this.shouldDeactivate(event)) {
      this.tribute.isActive = false;
      this.tribute.hideMenu();
    }
    this.commandEvent = false;

    const key = getCode(event.key);
    if (isHotkey(key) && element instanceof HTMLElement) {
      this.commandEvent = true;
      this.callbacks[key](event, element);
    }
  }

  input(event: Event) {
    const _element = event.currentTarget;
    this.inputEvent = true;
    this.keyup(event);
  }

  keyup(event: Event) {
    if (!(event instanceof KeyboardEvent)) return;

    const element = event.currentTarget;
    if (!(element instanceof HTMLElement)) return;

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
      const charCode = this.getTriggerCharCode();
      const trigger = this.tribute.range.getTrigger(charCode);
      if (typeof trigger !== 'undefined') {
        this.triggerChar(event, element, trigger);
      }
    }

    if (this.tribute.current.isMentionLengthUnderMinimum) {
      this.tribute.hideMenu();
      return;
    }

    if (((this.tribute.current.trigger || this.tribute.autocompleteMode) && this.commandEvent === false) || this.showMenuOnBackspace(event.key)) {
      this.tribute.showMenuFor(element, true);
    }
  }

  shouldDeactivate(event: Event) {
    if (!this.tribute.isActive) return false;
    if (!(event instanceof KeyboardEvent)) return false;

    if (this.tribute.current.mentionText?.length === 0) {
      let eventKeyPressed = false;
      const key = getCode(event.key);
      if (isHotkey(key)) {
        eventKeyPressed = true;
      }

      return !eventKeyPressed;
    }

    return false;
  }

  getTriggerCharCode() {
    const tribute = this.tribute;
    const info = tribute.range.getTriggerInfo(false, tribute.hasTrailingSpace, true, tribute.allowSpaces);

    if (info?.mentionTriggerChar) {
      return info.mentionTriggerChar.charCodeAt(0);
    }
    return undefined;
  }

  updateSelection(el: HTMLElement) {
    this.tribute.current.element = el;
    const info = this.tribute.range.getTriggerInfo(false, this.tribute.hasTrailingSpace, true, this.tribute.allowSpaces);

    if (info) {
      this.tribute.current.updateSelection(info);
    }
  }

  triggerChar(_e: Event, el: HTMLElement, trigger: string) {
    const tribute = this.tribute;
    tribute.current.trigger = trigger;

    const collectionItem = tribute.collection.find((item) => {
      return item.trigger === trigger;
    });

    tribute.current.collection = collectionItem;

    if (!tribute.current.isMentionLengthUnderMinimum && this.inputEvent) {
      tribute.showMenuFor(el, true);
    }
  }

  _callbacks?: { [key in hotkeyType]: (e: Event, el: HTMLElement) => void };
  get callbacks(): { [key in hotkeyType]: (e: Event, el: HTMLElement) => void } {
    if (!this._callbacks) {
      this._callbacks = {
        enter: (e: Event, _el: HTMLElement) => {
          // choose selection
          const filteredItems = this.tribute.current.filteredItems;
          if (this.tribute.isActive && filteredItems?.length) {
            e.preventDefault();
            e.stopPropagation();

            if (this.tribute.current.filteredItems?.length === 0) {
              this.tribute.menu.unselect();
            }

            setTimeout(() => {
              this.tribute.current.selectItemAtIndex(this.tribute.menu.selected.toString(), e);
              this.tribute.hideMenu();
            }, 0);
          }
        },
        escape: (e: Event, _el: HTMLElement) => {
          if (this.tribute.isActive) {
            e.preventDefault();
            e.stopPropagation();
            this.tribute.isActive = false;
            this.tribute.hideMenu();
          }
        },
        tab: (e: Event, el: HTMLElement) => {
          // choose first match
          this.callbacks.enter(e, el);
        },
        space: (e: Event, el: HTMLElement) => {
          if (this.tribute.isActive) {
            if (this.tribute.spaceSelectsMatch) {
              this.callbacks.enter(e, el);
            } else if (!this.tribute.allowSpaces) {
              e.stopPropagation();
              setTimeout(() => {
                this.tribute.hideMenu();
                this.tribute.isActive = false;
              }, 0);
            }
          }
        },
        arrowup: (e: Event, _el: HTMLElement) => {
          // navigate up ul
          if (this.tribute.isActive && this.tribute.current.filteredItems) {
            e.preventDefault();
            e.stopPropagation();

            const count = this.tribute.current.filteredItems.length;
            this.tribute.menu.up(count);
          }
        },
        arrowdown: (e: Event, _el: HTMLElement) => {
          // navigate down ul
          if (this.tribute.isActive && this.tribute.current.filteredItems) {
            e.preventDefault();
            e.stopPropagation();

            const count = this.tribute.current.filteredItems.length;
            this.tribute.menu.down(count);
          }
        },
        backspace: (_e: Event, el: HTMLElement) => {
          if (this.tribute.isActive) {
            if (this.tribute.current && this.tribute.current.mentionText.length < 1) {
              this.tribute.hideMenu();
            } else {
              this.tribute.showMenuFor(el);
            }
          }
        },
      };
    }
    return this._callbacks;
  }

  showMenuOnBackspace(key: string) {
    const isBackspace = key === 'Backspace';
    return isTextAreaOrInput(this.tribute.current.element) ? isBackspace : this.tribute.isActive && isBackspace;
  }
}

/*
 * Filter to ignore input during IME(Input Method Editor) conversion
 */
class CompositionFilter {
  private isComposing = false;
  #isFirefox?: boolean;

  protected get isFirefox() {
    if (this.#isFirefox !== undefined) {
      return this.#isFirefox;
    }
    this.#isFirefox = window.navigator.userAgent.toLowerCase().includes('firefox');
    return this.#isFirefox;
  }

  compositionstart(_event: Event) {
    // console.log(`composition start: ${this.isComposing}`);
    this.isComposing = true;
  }

  compositionend(event: Event) {
    // console.log(`composition end: ${this.isComposing}`);
    if (event instanceof CompositionEvent && this.isComposing) {
      this.isComposing = false;
      if (!this.isFirefox) {
        event.target?.dispatchEvent(
          new InputEvent('input', {
            inputType: 'insertText',
            data: event.data,
            isComposing: false,
          }),
        );
      }
    }
  }

  keydown(event: Event) {
    // console.log(`keydown: ${this.isComposing}`);
    if (!(event instanceof KeyboardEvent)) return;

    if (this.isComposing && event.code === 'Enter') {
      this.isComposing = false;
    }
  }

  input(event: Event) {
    // console.log(`input: ${this.isComposing}`);
    if (!(event instanceof InputEvent)) return;

    if (event.inputType === 'insertFromComposition') {
      this.isComposing = false;
    }
    if (this.isComposing) {
      event.stopImmediatePropagation();
    }
  }
}

function getCode(key: string) {
  return key === ' ' ? 'space' : key.toLowerCase();
}

function includes<A extends ReadonlyArray<unknown>>(array: A, input: unknown): input is A[number] {
  return array.includes(input);
}

function isHotkey(code: string): code is hotkeyType {
  return includes(hotkeys, code);
}

export default TributeEvents;
