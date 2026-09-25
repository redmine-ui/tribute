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
import type { Coordinate, ITribute, ITributeRange, TributeItem, TriggerInfo } from './type';

class TributeRange<T extends {}> implements ITributeRange<T>, ITributeRangeContext<T> {
  tribute: ITribute<T>;
  readonly element: HTMLElement;

  constructor(tribute: ITribute<T>, element: HTMLElement) {
    this.tribute = tribute;
    this.element = element;
  }

  private get triggerInfoParser() {
    return this.tribute.autocompleteMode ? autocompleteTriggerInfoParser : nonAutocompleteTriggerInfoParser;
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
    const context = this.tribute.contextFor(this.element);

    if (context.collection) {
      iframe = context.collection.iframe;
    }

    if (typeof iframe === 'undefined' || iframe === null || iframe.contentWindow === null) {
      return document;
    }

    return iframe.contentWindow.document;
  }

  positionMenuAtCaret(scrollTo: boolean) {
    const info = this.triggerInfoParser.getTriggerInfo(this, false, this.tribute.hasTrailingSpace, true, this.tribute.allowSpaces);

    if (typeof info === 'undefined' || typeof this.element === 'undefined') return;

    const coordinates = this.rangeHandler.getCoordinate(this, this.element, info.mentionPosition);

    if (coordinates) {
      const context = this.tribute.contextFor(this.element);
      context.menu.positionAtCaret(info, coordinates);
    }

    if (scrollTo) {
      this.scrollIntoView();
    }
  }

  get menuContainerIsBody() {
    return this.tribute.menuContainer === document.body || !this.tribute.menuContainer;
  }

  replaceTriggerText(text: string | HTMLElement, requireLeadingSpace: boolean, hasTrailingSpace: boolean, originalEvent: Event, item: TributeItem<T>) {
    const info = this.triggerInfoParser.getTriggerInfo(this, true, hasTrailingSpace, requireLeadingSpace, this.tribute.allowSpaces);
    const context = this.tribute.contextFor(this.element);

    if (typeof info === 'undefined' || typeof this.element === 'undefined') return;
    const replaceEvent = new CustomEvent('tribute-replaced', {
      detail: {
        item: item,
        instance: context,
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
    if (this.tribute.collection[0]?.iframe) {
      const iframe = this.tribute.collection[0].iframe.contentWindow;
      if (iframe) {
        return iframe.getSelection();
      }
    }

    if (this.tribute.collection[0]?.shadowRoot) {
      return this.tribute.collection[0].shadowRoot.getSelection();
    }

    return window.getSelection();
  }

  getTextPrecedingCurrentSelection() {
    if (typeof this.element === 'undefined') return;

    return this.rangeHandler.getTextPrecedingCurrentSelection(this, this.element);
  }

  isMenuOffScreen(coordinates: Coordinate, menuDimensions: { width: number; height: number }) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const doc = document.documentElement;
    const windowLeft = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
    const windowTop = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0);

    const menuTop =
      typeof coordinates.top === 'number'
        ? coordinates.top
        : typeof coordinates.bottom === 'number'
          ? windowTop + windowHeight - coordinates.bottom - menuDimensions.height
          : undefined;
    const menuRight =
      typeof coordinates.right === 'number' ? coordinates.right : typeof coordinates.left === 'number' ? coordinates.left + menuDimensions.width : undefined;
    const menuBottom =
      typeof coordinates.bottom === 'number' ? coordinates.bottom : typeof coordinates.top === 'number' ? coordinates.top + menuDimensions.height : undefined;
    const menuLeft =
      typeof coordinates.left === 'number'
        ? coordinates.left
        : typeof coordinates.right === 'number'
          ? windowLeft + windowWidth - coordinates.right - menuDimensions.width
          : undefined;

    return {
      top: typeof menuTop === 'number' ? menuTop < Math.floor(windowTop) : undefined,
      right: typeof menuRight === 'number' ? menuRight > Math.ceil(windowLeft + windowWidth) : undefined,
      bottom: typeof menuBottom === 'number' ? menuBottom > Math.ceil(windowTop + windowHeight) : undefined,
      left: typeof menuLeft === 'number' ? menuLeft < Math.floor(windowLeft) : undefined,
    };
  }

  scrollIntoView(_elem?: unknown) {
    const reasonableBuffer = 20;
    let clientRect: DOMRect | undefined;
    const maxScrollDisplacement = 100;
    const context = this.tribute.contextFor(this.element);
    let e = context.menu.element;

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
