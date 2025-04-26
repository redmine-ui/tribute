// Thanks to https://github.com/jeff-collins/ment.io
import { isContentEditable, isNotContentEditable } from './helpers.js';
import type { Coordinate, ITribute, ITributeContext, ITributeRange, TributeItem, TriggerInfo } from './type';

type Rect = {
  top: number;
  left: number;
  height: number;
  width: number;
};

type SelectionInfo = {
  selected: Node;
  path?: (number | undefined)[];
  offset?: number;
};

type Trigger = {
  mostRecentTriggerCharPos: number;
  triggerChar: string;
  requireLeadingSpace: boolean;
};

class TributeRange<T extends {}> implements ITributeRange<T> {
  tribute: ITribute<T>;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
  }

  getDocument() {
    let iframe: HTMLIFrameElement | null | undefined;
    if (this.tribute.current.collection) {
      iframe = this.tribute.current.collection.iframe;
    }

    if (typeof iframe === 'undefined' || iframe === null || iframe.contentWindow === null) {
      return document;
    }

    return iframe.contentWindow.document;
  }

  positionMenuAtCaret(scrollTo: boolean) {
    const context = this.tribute.current;
    const info = this.getTriggerInfo(false, this.tribute.hasTrailingSpace, true, this.tribute.allowSpaces, this.tribute.autocompleteMode);

    if (typeof context?.element === 'undefined' || typeof info === 'undefined') return;

    const coordinates = isNotContentEditable(context.element)
      ? this.getTextAreaOrInputUnderlinePosition(context.element, info.mentionPosition)
      : this.getContentEditableCaretPosition(info.mentionPosition);

    if (coordinates) {
      this.tribute.menu.positionAtCaret(info, coordinates);
    }

    if (scrollTo) {
      this.scrollIntoView();
    }
  }

  get menuContainerIsBody() {
    return this.tribute.menuContainer === document.body || !this.tribute.menuContainer;
  }

  replaceTriggerText(text: string | HTMLElement, requireLeadingSpace: boolean, hasTrailingSpace: boolean, originalEvent: Event, item: TributeItem<T>) {
    const info = this.getTriggerInfo(true, hasTrailingSpace, requireLeadingSpace, this.tribute.allowSpaces, this.tribute.autocompleteMode);
    const context = this.tribute.current;

    if (typeof context?.element === 'undefined' || typeof info === 'undefined') return;
    const replaceEvent = new CustomEvent('tribute-replaced', {
      detail: {
        item: item,
        instance: context,
        context: info,
        event: originalEvent,
      },
    });

    if (isNotContentEditable(context.element)) {
      const myField = context.element;
      const textSuffix = typeof this.tribute.replaceTextSuffix === 'string' ? this.tribute.replaceTextSuffix : ' ';
      const _text = text + textSuffix;
      const startPos = info.mentionPosition;
      let endPos = info.mentionPosition + (info.mentionText?.length || 0) + (textSuffix === '' ? 1 : textSuffix.length);
      if (!this.tribute.autocompleteMode) {
        endPos += (info.mentionTriggerChar?.length || 0) - 1;
      }
      myField.selectionStart = startPos + _text.length;
      myField.value = myField.value.substring(0, startPos) + _text + myField.value.substring(endPos, myField.value.length);
      myField.selectionEnd = startPos + _text.length;
    } else {
      let _text = text;
      if (_text instanceof HTMLElement) {
        // skip adding suffix yet - TODO later
        // text.appendChild(this.getDocument().createTextNode(textSuffix))
      } else {
        // add a space to the end of the pasted text
        const textSuffix = typeof this.tribute.replaceTextSuffix === 'string' ? this.tribute.replaceTextSuffix : '\xA0';
        _text += textSuffix;
      }
      let endPos = info.mentionPosition + (info.mentionText?.length || 0);
      if (!this.tribute.autocompleteMode) {
        endPos += info.mentionTriggerChar?.length || 0;
      }
      this.pasteHtml(_text, info.mentionPosition, endPos);
    }

    context.element.dispatchEvent(new CustomEvent('input', { bubbles: true }));
    context.element.dispatchEvent(replaceEvent);
  }

  pasteHtml(htmlOrElem: string | HTMLElement, startPos: number, endPos: number): void {
    const sel = this.getWindowSelection();
    const range = this.getDocument().createRange();
    if (sel === null || sel.anchorNode === null) return;

    range.setStart(sel.anchorNode, startPos);
    range.setEnd(sel.anchorNode, endPos);
    range.deleteContents();

    const el = this.getDocument().createElement('div');
    if (htmlOrElem instanceof HTMLElement) {
      el.appendChild(htmlOrElem);
    } else {
      el.innerHTML = htmlOrElem;
    }
    const frag = this.getDocument().createDocumentFragment();
    let node: Node;
    let lastNode: Node | undefined;
    while (el.firstChild) {
      node = el.firstChild;
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);

    // Preserve the selection
    if (lastNode) {
      const _range = range.cloneRange();
      _range.setStartAfter(lastNode);
      _range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(_range);
    }
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

  getNodePositionInParent(element: Node) {
    if (element.parentNode === null) {
      return 0;
    }

    for (let i = 0; i < element.parentNode.childNodes.length; i++) {
      const node = element.parentNode.childNodes[i];

      if (node === element) {
        return i;
      }
    }
    return undefined;
  }

  getContentEditableSelectedPath(context: ITributeContext<T>): SelectionInfo | undefined {
    const sel = this.getWindowSelection();
    if (sel === null) return undefined;

    let selected = sel?.anchorNode;
    const path: (number | undefined)[] = [];
    let offset: number;

    if (selected instanceof Node) {
      let i: number | undefined;
      let ce = selected instanceof HTMLElement ? selected.contentEditable : false;
      while (selected !== null && ce !== 'true') {
        i = this.getNodePositionInParent(selected);
        path.push(i);
        selected = selected.parentNode;

        if (selected instanceof HTMLElement) {
          ce = selected.contentEditable;
        }
      }
      path.reverse();

      // getRangeAt may not exist, need alternative
      offset = sel.getRangeAt(0).startOffset;
      if (selected) {
        return {
          selected: selected,
          path: path,
          offset: offset,
        };
      }
    }
    return undefined;
  }

  getTextPrecedingCurrentSelection() {
    const context = this.tribute.current;
    let text = '';
    if (typeof context.element === 'undefined') return text;

    if (isNotContentEditable(context.element)) {
      const textComponent = context.element;
      const startPos = textComponent.selectionStart;
      if (textComponent.value && startPos !== null && startPos >= 0) {
        text = textComponent.value.substring(0, startPos);
      }
    } else {
      const node = this.getWindowSelection();
      if (node === null) return text;
      const selectedElem = node.anchorNode;

      if (selectedElem != null) {
        const workingNodeContent = selectedElem.textContent;
        const sel = this.getWindowSelection();
        if (sel === null) return;

        const selectStartOffset = sel.getRangeAt(0).startOffset;

        if (workingNodeContent && selectStartOffset >= 0) {
          text = workingNodeContent.substring(0, selectStartOffset);
        }
      }
    }

    return text;
  }

  getLastWordInText(text: string) {
    let wordsArray: string[] | undefined;
    if (this.tribute.autocompleteMode) {
      if (this.tribute.autocompleteSeparator) {
        wordsArray = text.split(this.tribute.autocompleteSeparator);
      } else {
        wordsArray = [text];
      }
    } else {
      wordsArray = text.split(/\s+/);
    }
    const wordsCount = wordsArray.length - 1;
    return wordsArray[wordsCount];
  }

  getTriggerInfo(
    menuAlreadyActive: boolean,
    hasTrailingSpace: boolean,
    requireLeadingSpace: boolean,
    allowSpaces: boolean,
    isAutocomplete: boolean,
  ): TriggerInfo | undefined {
    const context = this.tribute.current;
    const selectionInfo = this._getSelectionInfo(context);
    const effectiveRange = this.getTextPrecedingCurrentSelection();

    if (isAutocomplete && typeof selectionInfo !== 'undefined' && typeof effectiveRange !== 'undefined') {
      return this._getTriggerInfoWithAutocomplete(selectionInfo, effectiveRange);
    }

    if (effectiveRange === undefined || effectiveRange === null) return;

    const trigger = this._getTrigger(requireLeadingSpace, effectiveRange);

    if (trigger) {
      return this._getTriggerInfoNonAutocomplete(menuAlreadyActive, hasTrailingSpace, allowSpaces, effectiveRange, trigger, selectionInfo);
    }

    return undefined;
  }

  _getSelectionInfo(context: ITributeContext<T>): SelectionInfo | undefined {
    if (typeof context.element === 'undefined') return undefined;

    if (isContentEditable(context.element)) {
      const selectionInfo = this.getContentEditableSelectedPath(context);
      if (selectionInfo) {
        return {
          selected: selectionInfo.selected,
          path: selectionInfo.path,
          offset: selectionInfo.offset,
        };
      }
    } else {
      return { selected: context.element };
    }
    return undefined;
  }

  _getTriggerInfoWithAutocomplete(selectionInfo: SelectionInfo, effectiveRange: string) {
    const lastWordOfEffectiveRange = this.getLastWordInText(effectiveRange);

    return {
      mentionPosition: effectiveRange.length - (lastWordOfEffectiveRange || '').length,
      mentionText: lastWordOfEffectiveRange,
      mentionSelectedElement: selectionInfo.selected,
      mentionSelectedPath: selectionInfo.path,
      mentionSelectedOffset: selectionInfo.offset,
    };
  }

  _getTrigger(requireLeadingSpace: boolean, effectiveRange: string): Trigger | undefined {
    let mostRecentTriggerCharPos = -1;
    let triggerChar: string | undefined;
    let _requireLeadingSpace: boolean | undefined = requireLeadingSpace;

    for (const config of this.tribute.collection) {
      const c = config.trigger;
      const idx = config.requireLeadingSpace ? this.lastIndexWithLeadingSpace(effectiveRange, c) : effectiveRange.lastIndexOf(c);

      if (idx > mostRecentTriggerCharPos) {
        mostRecentTriggerCharPos = idx;
        triggerChar = c;
        _requireLeadingSpace = config.requireLeadingSpace;
      }
    }

    if (
      typeof triggerChar !== 'undefined' &&
      mostRecentTriggerCharPos >= 0 &&
      (mostRecentTriggerCharPos === 0 || !_requireLeadingSpace || /\s/.test(effectiveRange.substring(mostRecentTriggerCharPos - 1, mostRecentTriggerCharPos)))
    ) {
      return {
        mostRecentTriggerCharPos,
        triggerChar,
        requireLeadingSpace: !!_requireLeadingSpace,
      };
    }
    return undefined;
  }

  _getTriggerInfoNonAutocomplete(
    menuAlreadyActive: boolean,
    hasTrailingSpace: boolean,
    allowSpaces: boolean,
    effectiveRange: string,
    trigger: Trigger,
    selectionInfo?: SelectionInfo,
  ) {
    let currentTriggerSnippet = effectiveRange.substring(trigger.mostRecentTriggerCharPos + trigger.triggerChar.length, effectiveRange.length);

    trigger.triggerChar = effectiveRange.substring(trigger.mostRecentTriggerCharPos, trigger.mostRecentTriggerCharPos + trigger.triggerChar.length);
    const firstSnippetChar = currentTriggerSnippet.substring(0, 1);
    const leadingSpace = currentTriggerSnippet.length > 0 && (firstSnippetChar === ' ' || firstSnippetChar === '\xA0');
    if (hasTrailingSpace) {
      currentTriggerSnippet = currentTriggerSnippet.trim();
    }

    const regex = allowSpaces ? /[^\S ]/g : /[\xA0\s]/g;

    this.tribute.hasTrailingSpace = regex.test(currentTriggerSnippet);

    if (!leadingSpace && (menuAlreadyActive || !regex.test(currentTriggerSnippet))) {
      return {
        mentionPosition: trigger.mostRecentTriggerCharPos,
        mentionText: currentTriggerSnippet,
        mentionSelectedElement: selectionInfo?.selected,
        mentionSelectedPath: selectionInfo?.path,
        mentionSelectedOffset: selectionInfo?.offset,
        mentionTriggerChar: trigger.triggerChar,
      };
    }
    return undefined;
  }

  lastIndexWithLeadingSpace(str: string, trigger: string) {
    const reversedStr = str.split('').reverse().join('');
    let index = -1;

    for (let cidx = 0, len = str.length; cidx < len; cidx++) {
      const firstChar = cidx === str.length - 1;
      const rev = reversedStr[cidx + 1];
      const leadingSpace = typeof rev === 'undefined' ? false : /\s/.test(rev);

      let match = true;
      for (let triggerIdx = trigger.length - 1; triggerIdx >= 0; triggerIdx--) {
        if (trigger[triggerIdx] !== reversedStr[cidx - triggerIdx]) {
          match = false;
          break;
        }
      }

      if (match && (firstChar || leadingSpace)) {
        index = str.length - 1 - cidx;
        break;
      }
    }

    return index;
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

  getTextAreaOrInputUnderlinePosition(element: HTMLInputElement | HTMLTextAreaElement, position: number, flipped?: unknown): Coordinate | undefined {
    const properties = [
      'direction',
      'boxSizing',
      'width',
      'height',
      'overflowX',
      'overflowY',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'borderStyle',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'fontStyle',
      'fontVariant',
      'fontWeight',
      'fontStretch',
      'fontSize',
      'fontSizeAdjust',
      'lineHeight',
      'fontFamily',
      'textAlign',
      'textTransform',
      'textIndent',
      'textDecoration',
      'letterSpacing',
      'wordSpacing',
    ];

    const div = this.getDocument().createElement('div');
    div.id = 'input-textarea-caret-position-mirror-div';
    this.getDocument().body.appendChild(div);

    const computed = getComputedStyle(element);

    div.style.whiteSpace = 'pre-wrap';
    if (element.nodeName !== 'INPUT') {
      div.style.wordWrap = 'break-word';
    }

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';

    // transfer the element's properties to the div
    for (const prop of properties) {
      const value = computed.getPropertyValue(prop);
      div.style.setProperty(prop, value);
    }

    //NOT SURE WHY THIS IS HERE AND IT DOESNT SEEM HELPFUL
    // if (isFirefox) {
    //     style.width = `${(parseInt(computed.width) - 2)}px`
    //     if (element.scrollHeight > parseInt(computed.height))
    //         style.overflowY = 'scroll'
    // } else {
    //     style.overflow = 'hidden'
    // }

    const span0 = document.createElement('span');
    span0.textContent = element.value.substring(0, position);
    div.appendChild(span0);

    if (element.nodeName === 'INPUT' && div.textContent !== null) {
      div.textContent = div.textContent.replace(/\s/g, ' ');
    }

    //Create a span in the div that represents where the cursor
    //should be
    const span = this.getDocument().createElement('span');
    //we give it no content as this represents the cursor
    span.textContent = '&#x200B;';
    div.appendChild(span);

    const span2 = this.getDocument().createElement('span');
    span2.textContent = element.value.substring(position);
    div.appendChild(span2);

    const rect = element.getBoundingClientRect();

    //position the div exactly over the element
    //so we can get the bounding client rect for the span and
    //it should represent exactly where the cursor is
    div.style.position = 'fixed';
    div.style.left = `${rect.left}px`;
    div.style.top = `${rect.top}px`;
    div.style.width = `${rect.width}px`;
    div.style.height = `${rect.height}px`;
    div.scrollTop = element.scrollTop;

    const spanRect = span.getBoundingClientRect();
    this.getDocument().body.removeChild(div);
    return this.getFixedCoordinatesRelativeToRect(spanRect);
  }

  getContentEditableCaretPosition(selectedNodePosition: number) {
    const sel = this.getWindowSelection();
    if (sel === null || sel.anchorNode === null) return;

    const range = this.getDocument().createRange();
    range.setStart(sel.anchorNode, selectedNodePosition);
    range.setEnd(sel.anchorNode, selectedNodePosition);

    range.collapse(false);

    const rect = range.getBoundingClientRect();

    return this.getFixedCoordinatesRelativeToRect(rect);
  }

  getFixedCoordinatesRelativeToRect(rect: Rect) {
    const coordinates: Coordinate = {
      position: 'fixed',
      left: rect.left,
      top: rect.top + rect.height,
    };

    const menuDimensions = this.tribute.menu.getDimensions();

    const availableSpaceOnTop = rect.top;
    const availableSpaceOnBottom = window.innerHeight - (rect.top + rect.height);

    //check to see where's the right place to put the menu vertically
    const height = menuDimensions.height;
    if (height !== null && availableSpaceOnBottom < height) {
      if (availableSpaceOnTop >= height || availableSpaceOnTop > availableSpaceOnBottom) {
        coordinates.top = 'auto';
        coordinates.bottom = window.innerHeight - rect.top;
        if (availableSpaceOnBottom < height) {
          coordinates.maxHeight = availableSpaceOnTop;
        }
      } else {
        if (availableSpaceOnTop < height) {
          coordinates.maxHeight = availableSpaceOnBottom;
        }
      }
    }

    const availableSpaceOnLeft = rect.left;
    const availableSpaceOnRight = window.innerWidth - rect.left;

    //check to see where's the right place to put the menu horizontally
    const width = menuDimensions.width;
    if (width !== null && availableSpaceOnRight < width) {
      if (availableSpaceOnLeft >= width || availableSpaceOnLeft > availableSpaceOnRight) {
        coordinates.left = 'auto';
        coordinates.right = window.innerWidth - rect.left;
        if (availableSpaceOnRight < width) {
          coordinates.maxWidth = availableSpaceOnLeft;
        }
      } else {
        if (availableSpaceOnLeft < width) {
          coordinates.maxWidth = availableSpaceOnRight;
        }
      }
    }

    return coordinates;
  }

  menu?: Node;
  scrollIntoView(elem?: unknown) {
    const reasonableBuffer = 20;
    let clientRect: DOMRect | undefined;
    const maxScrollDisplacement = 100;
    let e = this.menu;

    if (typeof e === 'undefined') return;

    while (clientRect === undefined || clientRect.height === 0) {
      if (e instanceof HTMLElement) {
        clientRect = e.getBoundingClientRect();
      }

      if (clientRect?.height === 0) {
        e = e.childNodes[0];
        if (e === undefined || !('getBoundingClientRect' in e)) {
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
