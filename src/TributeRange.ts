// Thanks to https://github.com/jeff-collins/ment.io
import { isTextAreaOrInput } from './helpers';
import {
  autocompleteTriggerInfoParser,
  contentEditableRangeHandler,
  type ITributeRangeContext,
  nonAutocompleteTriggerInfoParser,
  type SelectionInfo,
  textAreaOrInputRangeHandler,
} from './range-handler';
import type { ITributeContext, ITributeRange, TributeItem, TriggerInfo } from './type';

class TributeRange<T extends {}> implements ITributeRange<T>, ITributeRangeContext<T> {
  readonly context: ITributeContext<T>;
  readonly element: HTMLElement;

  constructor(context: ITributeContext<T>, element: HTMLElement) {
    this.context = context;
    this.element = element;
  }

  private get triggerInfoParser() {
    return this.context.tribute.autocompleteMode ? autocompleteTriggerInfoParser : nonAutocompleteTriggerInfoParser;
  }

  private get rangeHandler() {
    return isTextAreaOrInput(this.element) ? textAreaOrInputRangeHandler : contentEditableRangeHandler;
  }

  getTriggerInfo(menuAlreadyActive: boolean, hasTrailingSpace: boolean, requireLeadingSpace: boolean, allowSpaces: boolean): TriggerInfo | undefined {
    return this.triggerInfoParser.getTriggerInfo(this, menuAlreadyActive, hasTrailingSpace, requireLeadingSpace, allowSpaces);
  }

  getTrigger(charCode?: number) {
    return this.triggerInfoParser.getTrigger(this, charCode);
  }

  insertText(text: string): void {
    if (!this.element) return;
    this.rangeHandler.insertText(this, this.element, text);
  }

  focusAtEnd(): void {
    if (!this.element || this.element === document.activeElement) return;
    this.rangeHandler.focusAtEnd(this, this.element);
  }

  getDocument() {
    let iframe: HTMLIFrameElement | null | undefined;

    if (this.context.collection) {
      iframe = this.context.collection.iframe;
    }

    if (typeof iframe === 'undefined' || iframe === null || iframe.contentWindow === null) {
      return document;
    }

    return iframe.contentWindow.document;
  }

  positionMenuAtCaret(scrollTo: boolean) {
    const info = this.triggerInfoParser.getTriggerInfo(this, false, this.context.tribute.hasTrailingSpace, true, this.context.tribute.allowSpaces);

    if (typeof info === 'undefined' || typeof this.element === 'undefined') return;

    const coordinates = this.rangeHandler.getCoordinate(this, this.element, info.mentionPosition);

    if (coordinates) {
      this.context.menu.positionAtCaret(info, coordinates);
    }

    if (scrollTo) {
      this.scrollIntoView(this.context.menu.element);
    }
  }

  get menuContainerIsBody() {
    return this.context.tribute.menuContainer === document.body || !this.context.tribute.menuContainer;
  }

  replaceTriggerText(text: string | HTMLElement, requireLeadingSpace: boolean, hasTrailingSpace: boolean, originalEvent: Event, item: TributeItem<T>) {
    const info = this.triggerInfoParser.getTriggerInfo(this, true, hasTrailingSpace, requireLeadingSpace, this.context.tribute.allowSpaces);

    if (typeof info === 'undefined' || typeof this.element === 'undefined') return;
    const replaceEvent = new CustomEvent('tribute-replaced', {
      detail: {
        item: item,
        instance: this.context,
        context: info,
        event: originalEvent,
      },
    });
    this.rangeHandler.replaceTriggerText(this, info, text, this.element);

    this.element.dispatchEvent(new CustomEvent('input', { bubbles: true }));
    this.element.dispatchEvent(replaceEvent);
  }

  getSelectionInfo(): SelectionInfo | undefined {
    if (typeof this.element === 'undefined') return;

    return this.rangeHandler.getSelectionInfo(this, this.element);
  }

  getWindowSelection() {
    const tribute = this.context.tribute;
    if (tribute.collection[0]?.iframe) {
      const iframe = tribute.collection[0].iframe.contentWindow;
      if (iframe) {
        return iframe.getSelection();
      }
    }

    if (tribute.collection[0]?.shadowRoot) {
      return tribute.collection[0].shadowRoot.getSelection();
    }

    return window.getSelection();
  }

  getTextPrecedingCurrentSelection() {
    if (typeof this.element === 'undefined') return;

    return this.rangeHandler.getTextPrecedingCurrentSelection(this, this.element);
  }

  scrollIntoView(elem: HTMLElement | null) {
    let e = elem;
    const reasonableBuffer = 20;
    let clientRect: DOMRect | undefined;
    const maxScrollDisplacement = 100;

    if (e === null) return;

    while (clientRect === undefined || clientRect.height === 0) {
      if (e instanceof HTMLElement) {
        clientRect = e.getBoundingClientRect();
      }

      if (clientRect?.height === 0) {
        e = e.childNodes[0] as HTMLElement | null;
        if (e === undefined || e === null || !('getBoundingClientRect' in e)) {
          return;
        }
      }
    }

    const elemTop = clientRect.top;
    const elemBottom = elemTop + clientRect.height;

    if (elemTop < 0) {
      window.scrollTo(0, window.pageYOffset + clientRect.top - reasonableBuffer);
    } else if (elemBottom > window.innerHeight) {
      let maxY = window.pageYOffset + clientRect.top - reasonableBuffer;

      if (maxY - window.pageYOffset > maxScrollDisplacement) {
        maxY = window.pageYOffset + maxScrollDisplacement;
      }

      let targetY = window.pageYOffset - (window.innerHeight - elemBottom);

      if (targetY > maxY) {
        targetY = maxY;
      }

      window.scrollTo(0, targetY);
    }
  }
}

export default TributeRange;
