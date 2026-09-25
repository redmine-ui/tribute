import { isTextAreaOrInput } from './helpers';
import type { Coordinate, ITribute, TriggerInfo } from './type';

export type Rect = {
  top: number;
  left: number;
  height: number;
  width: number;
};

export type SelectionInfo = {
  selected: Node;
  path?: (number | undefined)[];
  offset?: number;
};

type Trigger = {
  mostRecentTriggerCharPos: number;
  triggerChar: string;
  requireLeadingSpace: boolean;
};

export interface ITributeRangeContext<T extends {}> {
  tribute: ITribute<T>;
  element: HTMLElement;
  getDocument(): Document;
  getWindowSelection(): Selection | null;
  getSelectionInfo(): SelectionInfo | undefined;
  getTextPrecedingCurrentSelection(): string | undefined;
  scrollIntoView(_elem?: unknown): void;
}

export const autocompleteTriggerInfoParser = {
  getTrigger<T extends {}>(_range: ITributeRangeContext<T>, _charCode?: number): string {
    return '';
  },

  getTriggerInfo<T extends {}>(
    range: ITributeRangeContext<T>,
    _menuAlreadyActive: boolean,
    _hasTrailingSpace: boolean,
    _requireLeadingSpace: boolean,
    _allowSpaces: boolean,
  ): TriggerInfo | undefined {
    const selectionInfo = range.getSelectionInfo();
    const effectiveRange = range.getTextPrecedingCurrentSelection();

    if (typeof selectionInfo !== 'undefined' && typeof effectiveRange !== 'undefined') {
      return autocompleteGetTriggerInfo(range, selectionInfo, effectiveRange);
    }
    return undefined;
  },
};

export const nonAutocompleteTriggerInfoParser = {
  getTrigger<T extends {}>(range: ITributeRangeContext<T>, charCode?: number): string | undefined {
    if (Number.isNaN(charCode) || !charCode) return;

    const trigger = range.tribute.triggers().find((trigger) => {
      return trigger?.charCodeAt(0) === charCode;
    });

    if (typeof trigger !== 'undefined') {
      return trigger;
    }
    return;
  },

  getTriggerInfo<T extends {}>(
    range: ITributeRangeContext<T>,
    menuAlreadyActive: boolean,
    hasTrailingSpace: boolean,
    requireLeadingSpace: boolean,
    allowSpaces: boolean,
  ): TriggerInfo | undefined {
    const selectionInfo = range.getSelectionInfo();
    const effectiveRange = range.getTextPrecedingCurrentSelection();
    if (effectiveRange === undefined || effectiveRange === null) return undefined;

    const trigger = nonAutocompleteGetTrigger(range, requireLeadingSpace, effectiveRange);
    if (trigger) {
      return nonAutocompleteGetTriggerInfoDetails(range, menuAlreadyActive, hasTrailingSpace, allowSpaces, effectiveRange, trigger, selectionInfo);
    }
    return undefined;
  },
};

function getFixedCoordinatesRelativeToRect<T extends {}>(range: ITributeRangeContext<T>, rect: Rect): Coordinate {
  const coordinates: Coordinate = {
    position: 'fixed',
    left: rect.left,
    top: rect.top + rect.height,
  };

  const context = range.tribute.contextFor(range.element);
  const menuDimensions = context.menu.getDimensions();

  const availableSpaceOnTop = rect.top;
  const availableSpaceOnBottom = window.innerHeight - (rect.top + rect.height);

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

function getLastWordInText<T extends {}>(range: ITributeRangeContext<T>, text: string): string | undefined {
  let wordsArray: string[] | undefined;
  const separator = range.tribute.autocompleteSeparator;
  if (separator !== null) {
    wordsArray = text.split(separator);
  } else {
    wordsArray = [text];
  }
  const wordsCount = wordsArray.length - 1;
  return wordsArray[wordsCount];
}

function lastIndexWithLeadingSpace(str: string, trigger: string): number {
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

function getNodePositionInParent(element: Node): number | undefined {
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

function getContentEditableSelectedPath<T extends {}>(range: ITributeRangeContext<T>): SelectionInfo | undefined {
  const sel = range.getWindowSelection();
  if (sel === null) return undefined;

  let selected = sel?.anchorNode;
  const path: (number | undefined)[] = [];
  let offset: number;

  if (selected instanceof Node) {
    let i: number | undefined;
    let ce = selected instanceof HTMLElement ? selected.contentEditable : false;
    while (selected !== null && ce !== 'true') {
      i = getNodePositionInParent(selected);
      path.push(i);
      selected = selected.parentNode;

      if (selected instanceof HTMLElement) {
        ce = selected.contentEditable;
      }
    }
    path.reverse();

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

function pasteHtml<T extends {}>(range: ITributeRangeContext<T>, htmlOrElem: string | HTMLElement, startPos: number, endPos: number): void {
  const sel = range.getWindowSelection();
  const r = range.getDocument().createRange();
  if (sel === null || sel.anchorNode === null) return;

  r.setStart(sel.anchorNode, startPos);
  r.setEnd(sel.anchorNode, endPos);
  r.deleteContents();

  const el = range.getDocument().createElement('div');
  if (htmlOrElem instanceof HTMLElement) {
    el.appendChild(htmlOrElem);
  } else {
    el.innerHTML = htmlOrElem;
  }
  const frag = range.getDocument().createDocumentFragment();
  let node: Node;
  let lastNode: Node | undefined;
  while (el.firstChild) {
    node = el.firstChild;
    lastNode = frag.appendChild(node);
  }
  r.insertNode(frag);

  if (lastNode) {
    const _range = r.cloneRange();
    _range.setStartAfter(lastNode);
    _range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(_range);
  }
}

// --- Parser Modules ---

function autocompleteGetTriggerInfo<T extends {}>(range: ITributeRangeContext<T>, selectionInfo: SelectionInfo, effectiveRange: string): TriggerInfo {
  const lastWordOfEffectiveRange = getLastWordInText(range, effectiveRange);

  return {
    mentionPosition: effectiveRange.length - (lastWordOfEffectiveRange || '').length,
    mentionText: lastWordOfEffectiveRange,
    mentionSelectedElement: selectionInfo.selected,
    mentionSelectedPath: selectionInfo.path,
    mentionSelectedOffset: selectionInfo.offset,
  };
}

function nonAutocompleteGetTrigger<T extends {}>(range: ITributeRangeContext<T>, requireLeadingSpace: boolean, effectiveRange: string): Trigger | undefined {
  let mostRecentTriggerCharPos = -1;
  let triggerChar: string | undefined;
  let _requireLeadingSpace: boolean | undefined = requireLeadingSpace;

  for (const config of range.tribute.collection) {
    const c = config.trigger;
    const idx = config.requireLeadingSpace ? lastIndexWithLeadingSpace(effectiveRange, c) : effectiveRange.lastIndexOf(c);

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

function nonAutocompleteGetTriggerInfoDetails<T extends {}>(
  range: ITributeRangeContext<T>,
  menuAlreadyActive: boolean,
  hasTrailingSpace: boolean,
  allowSpaces: boolean,
  effectiveRange: string,
  trigger: Trigger,
  selectionInfo?: SelectionInfo,
): TriggerInfo | undefined {
  let currentTriggerSnippet = effectiveRange.substring(trigger.mostRecentTriggerCharPos + trigger.triggerChar.length, effectiveRange.length);

  trigger.triggerChar = effectiveRange.substring(trigger.mostRecentTriggerCharPos, trigger.mostRecentTriggerCharPos + trigger.triggerChar.length);
  const firstSnippetChar = currentTriggerSnippet.substring(0, 1);
  const leadingSpace = currentTriggerSnippet.length > 0 && (firstSnippetChar === ' ' || firstSnippetChar === '\xA0');
  if (hasTrailingSpace) {
    currentTriggerSnippet = currentTriggerSnippet.trim();
  }

  const regex = allowSpaces ? /[^\S ]/g : /[\xA0\s]/g;

  range.tribute.hasTrailingSpace = regex.test(currentTriggerSnippet);

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

// --- Range Handler Modules ---

export const textAreaOrInputRangeHandler = {
  getCoordinate<T extends {}>(range: ITributeRangeContext<T>, element: HTMLElement, position: number, _flipped?: unknown): Coordinate | undefined {
    if (!isTextAreaOrInput(element)) return;

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

    const div = range.getDocument().createElement('div');
    div.id = 'input-textarea-caret-position-mirror-div';
    range.getDocument().body.appendChild(div);

    const computed = getComputedStyle(element);

    div.style.whiteSpace = 'pre-wrap';
    if (element.nodeName !== 'INPUT') {
      div.style.wordWrap = 'break-word';
    }

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';

    for (const prop of properties) {
      const value = computed.getPropertyValue(prop);
      div.style.setProperty(prop, value);
    }

    const span0 = document.createElement('span');
    span0.textContent = (element as HTMLInputElement | HTMLTextAreaElement).value.substring(0, position);
    div.appendChild(span0);

    if (element.nodeName === 'INPUT' && div.textContent !== null) {
      div.textContent = div.textContent.replace(/\s/g, ' ');
    }

    const span = range.getDocument().createElement('span');
    span.textContent = '\u200B';
    div.appendChild(span);

    const span2 = range.getDocument().createElement('span');
    span2.textContent = (element as HTMLInputElement | HTMLTextAreaElement).value.substring(position);
    div.appendChild(span2);

    const rect = element.getBoundingClientRect();

    div.style.position = 'fixed';
    div.style.left = `${rect.left}px`;
    div.style.top = `${rect.top}px`;
    div.style.width = `${rect.width}px`;
    div.style.height = `${rect.height}px`;
    div.scrollTop = element.scrollTop;

    const spanRect = span.getBoundingClientRect();
    range.getDocument().body.removeChild(div);
    return getFixedCoordinatesRelativeToRect(range, spanRect);
  },

  replaceTriggerText<T extends {}>(range: ITributeRangeContext<T>, info: TriggerInfo, text: string | HTMLElement, element: HTMLElement): void {
    if (!isTextAreaOrInput(element)) return;

    const myField = element as HTMLInputElement | HTMLTextAreaElement;
    const replaceTextSuffix = range.tribute.replaceTextSuffix;
    const textSuffix = typeof replaceTextSuffix === 'string' ? replaceTextSuffix : ' ';
    const _text = text + textSuffix;
    const startPos = info.mentionPosition;
    let endPos = info.mentionPosition + (info.mentionText?.length || 0) + (textSuffix === '' ? 1 : textSuffix.length);
    if (!range.tribute.autocompleteMode) {
      endPos += (info.mentionTriggerChar?.length || 0) - 1;
    }
    myField.selectionStart = startPos + _text.length;
    myField.value = myField.value.substring(0, startPos) + _text + myField.value.substring(endPos, myField.value.length);
    myField.selectionEnd = startPos + _text.length;
  },

  insertText<T extends {}>(_range: ITributeRangeContext<T>, element: HTMLElement, text: string): void {
    if (!isTextAreaOrInput(element)) return;

    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const scrollPos = input.scrollTop;
    let caretPos = input.selectionStart;

    if (caretPos === null || input.selectionEnd === null) return;

    const front = input.value.substring(0, caretPos);
    const back = input.value.substring(input.selectionEnd, input.value.length);
    input.value = front + text + back;
    caretPos = caretPos + text.length;
    input.selectionStart = caretPos;
    input.selectionEnd = caretPos;
    input.focus();
    input.scrollTop = scrollPos;
  },

  focusAtEnd<T extends {}>(_range: ITributeRangeContext<T>, element: HTMLElement): void {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;

    element.focus();
    const len = element.value.length;
    element.setSelectionRange(len, len);
  },

  getSelectionInfo<T extends {}>(_range: ITributeRangeContext<T>, element: HTMLElement): SelectionInfo | undefined {
    return { selected: element };
  },

  getTextPrecedingCurrentSelection<T extends {}>(_range: ITributeRangeContext<T>, element: HTMLElement): string | undefined {
    if (!isTextAreaOrInput(element)) return;

    const textComponent = element as HTMLInputElement | HTMLTextAreaElement;
    const startPos = textComponent.selectionStart;
    if (textComponent.value && startPos !== null && startPos >= 0) {
      return textComponent.value.substring(0, startPos);
    }
    return;
  },
};

export const contentEditableRangeHandler = {
  getCoordinate<T extends {}>(range: ITributeRangeContext<T>, _element: HTMLElement, position: number, _flipped?: unknown): Coordinate | undefined {
    const sel = range.getWindowSelection();
    if (sel === null || sel.anchorNode === null) return;

    const r = range.getDocument().createRange();
    r.setStart(sel.anchorNode, position);
    r.setEnd(sel.anchorNode, position);

    r.collapse(false);

    const rect = r.getBoundingClientRect();

    return getFixedCoordinatesRelativeToRect(range, rect);
  },

  replaceTriggerText<T extends {}>(range: ITributeRangeContext<T>, info: TriggerInfo, text: string | HTMLElement, _element: HTMLElement): void {
    let _text = text;
    if (_text instanceof HTMLElement) {
      // skip adding suffix yet
    } else {
      const replaceTextSuffix = range.tribute.replaceTextSuffix;
      const textSuffix = typeof replaceTextSuffix === 'string' ? replaceTextSuffix : '\xA0';
      _text += textSuffix;
    }
    let endPos = info.mentionPosition + (info.mentionText?.length || 0);
    if (!range.tribute.autocompleteMode) {
      endPos += info.mentionTriggerChar?.length || 0;
    }
    pasteHtml(range, _text, info.mentionPosition, endPos);
  },

  insertText<T extends {}>(_range: ITributeRangeContext<T>, _element: HTMLElement, text: string): void {
    const sel = window.getSelection();
    const range = sel?.getRangeAt(0);
    if (!sel || !range) return;

    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.selectNodeContents(textNode);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  },

  focusAtEnd<T extends {}>(_range: ITributeRangeContext<T>, element: HTMLElement): void {
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  },

  getSelectionInfo<T extends {}>(range: ITributeRangeContext<T>, _element: HTMLElement): SelectionInfo | undefined {
    const selectionInfo = getContentEditableSelectedPath(range);
    if (selectionInfo) {
      return {
        selected: selectionInfo.selected,
        path: selectionInfo.path,
        offset: selectionInfo.offset,
      };
    }
    return undefined;
  },

  getTextPrecedingCurrentSelection<T extends {}>(range: ITributeRangeContext<T>, _element: HTMLElement): string | undefined {
    const node = range.getWindowSelection();
    if (node === null) return '';
    const selectedElem = node.anchorNode;

    if (selectedElem != null) {
      const workingNodeContent = selectedElem.textContent;
      const sel = range.getWindowSelection();
      if (sel === null) return;

      const selectStartOffset = sel.getRangeAt(0).startOffset;

      if (workingNodeContent && selectStartOffset >= 0) {
        return workingNodeContent.substring(0, selectStartOffset);
      }
    }
    return;
  },
};
