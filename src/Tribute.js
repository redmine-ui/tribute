import TributeEvents from './TributeEvents.js';
import TributeMenuEvents from './TributeMenuEvents.js';
import TributeRange from './TributeRange.js';
import TributeSearch from './TributeSearch.js';

class Tribute {
  constructor({
    values = null,
    loadingItemTemplate = null,
    iframe = null,
    shadowRoot = null,
    selectClass = 'highlight',
    containerClass = 'tribute-container',
    itemClass = '',
    trigger = '@',
    autocompleteMode = false,
    autocompleteSeparator = /\s+/,
    selectTemplate = null,
    menuItemTemplate = null,
    lookup = 'key',
    fillAttr = 'value',
    collection = null,
    menuContainer = null,
    noMatchTemplate = null,
    requireLeadingSpace = true,
    allowSpaces = false,
    replaceTextSuffix = null,
    positionMenu = true,
    spaceSelectsMatch = false,
    searchOpts = {},
    menuItemLimit = null,
    menuShowMinLength = 0,
    closeOnScroll = false,
    maxDisplayItems = null,
    isBlocked = false,
  }) {
    this.autocompleteMode = autocompleteMode;
    this.autocompleteSeparator = autocompleteSeparator;
    this.menuSelected = 0;
    this.current = {};
    this.inputEvent = false;
    this.isActive = false;
    this.menuContainer = menuContainer;
    this.allowSpaces = allowSpaces;
    this.replaceTextSuffix = replaceTextSuffix;
    this.positionMenu = positionMenu;
    this.hasTrailingSpace = false;
    this.spaceSelectsMatch = spaceSelectsMatch;
    this.closeOnScroll = closeOnScroll;

    if (this.autocompleteMode) {
      trigger = '';
      allowSpaces = false;
    }

    if (values) {
      this.collection = [
        {
          // symbol that starts the lookup
          trigger: trigger,

          // is it wrapped in an iframe
          iframe: iframe,

          // is it wrapped in a web component
          shadowRoot: shadowRoot,

          // class applied to selected item
          selectClass: selectClass,

          // class applied to the Container
          containerClass: containerClass,

          // class applied to each item
          itemClass: itemClass,

          // function called on select that retuns the content to insert
          selectTemplate: selectTemplate ? selectTemplate.bind(this) : (item) => defaultSelectTemplate(this, item),

          // function called that returns content for an item
          menuItemTemplate: (menuItemTemplate || defaultMenuItemTemplate).bind(this),

          // function called when menu is empty, disables hiding of menu.
          noMatchTemplate: ((t) => {
            if (typeof t === 'string') {
              if (t.trim() === '') return null;
              return t;
            }
            if (typeof t === 'function') {
              return t.bind(this);
            }

            return noMatchTemplate || (() => '<li>No Match Found!</li>').bind(this);
          })(noMatchTemplate),

          // column to search against in the object
          lookup: lookup,

          // column that contains the content to insert by default
          fillAttr: fillAttr,

          // array of objects or a function returning an array of objects
          values: values,

          // useful for when values is an async function
          loadingItemTemplate: loadingItemTemplate,

          requireLeadingSpace: requireLeadingSpace,

          searchOpts: searchOpts,

          menuItemLimit: menuItemLimit,

          menuShowMinLength: menuShowMinLength,

          // Fix for maximum number of items added to the input for the specific Collection
          maxDisplayItems: maxDisplayItems,

          isBlocked: isBlocked,
        },
      ];
    } else if (collection) {
      if (this.autocompleteMode) console.warn('Tribute in autocomplete mode does not work for collections');
      this.collection = collection.map((item) => {
        return {
          trigger: item.trigger || trigger,
          iframe: item.iframe || iframe,
          selectClass: item.selectClass || selectClass,
          containerClass: item.containerClass || containerClass,
          itemClass: item.itemClass || itemClass,
          selectTemplate: item.selectTemplate ? item.selectTemplate.bind(this) : (item) => defaultSelectTemplate(this, item),
          menuItemTemplate: (item.menuItemTemplate || defaultMenuItemTemplate).bind(this),
          // function called when menu is empty, disables hiding of menu.
          noMatchTemplate: ((t) => {
            if (typeof t === 'string') {
              if (t.trim() === '') return null;
              return t;
            }
            if (typeof t === 'function') {
              return t.bind(this);
            }

            return noMatchTemplate || (() => '<li>No Match Found!</li>').bind(this);
          })(item.noMatchTemplate),
          lookup: item.lookup || lookup,
          fillAttr: item.fillAttr || fillAttr,
          values: item.values,
          loadingItemTemplate: item.loadingItemTemplate,
          requireLeadingSpace: item.requireLeadingSpace,
          searchOpts: item.searchOpts || searchOpts,
          menuItemLimit: item.menuItemLimit || menuItemLimit,
          menuShowMinLength: item.menuShowMinLength || menuShowMinLength,

          // Set maximum number of items added to the input for the specific Collection
          maxDisplayItems: item.maxDisplayItems || maxDisplayItems,
          isBlocked: item.isBlocked || isBlocked,
        };
      });
    } else {
      throw new Error('[Tribute] No collection specified.');
    }

    this.range = new TributeRange(this);
    this.events = new TributeEvents(this);
    this.menuEvents = new TributeMenuEvents(this);
    this.search = new TributeSearch(this);
  }

  get isActive() {
    return this._isActive;
  }

  set isActive(val) {
    if (this._isActive !== val) {
      this._isActive = val;
      if (this.current.element) {
        const noMatchEvent = new CustomEvent(`tribute-active-${val}`);
        this.current.element.dispatchEvent(noMatchEvent);
      }
    }
  }

  static inputTypes() {
    return ['TEXTAREA', 'INPUT'];
  }

  triggers() {
    return this.collection.map((config) => {
      return config.trigger;
    });
  }

  attach(el) {
    if (!el) {
      throw new Error('[Tribute] Must pass in a DOM node or NodeList.');
    }

    // Check if it is a jQuery collection
    const _el = typeof jQuery !== 'undefined' && el instanceof jQuery ? el.get() : el;

    // Is el an Array/Array-like object?
    if (_el.constructor === NodeList || _el.constructor === HTMLCollection || _el.constructor === Array) {
      const length = _el.length;
      for (let i = 0; i < length; ++i) {
        this._attach(_el[i]);
      }
    } else {
      this._attach(_el);
    }
  }

  _attach(el) {
    if (el.hasAttribute('data-tribute')) {
      console.warn(`Tribute was already bound to ${el.nodeName}`);
    }

    this.ensureEditable(el);
    this.events.bind(el);
    el.setAttribute('data-tribute', true);
  }

  ensureEditable(element) {
    if (Tribute.inputTypes().indexOf(element.nodeName) === -1) {
      if (typeof element.contentEditable === 'string') {
        element.contentEditable = true;
      } else {
        throw new Error(`[Tribute] Cannot bind to ${element.nodeName}, not contentEditable`);
      }
    }
  }

  createMenu(containerClass) {
    const wrapper = this.range.getDocument().createElement('div');
    const ul = this.range.getDocument().createElement('ul');
    wrapper.className = containerClass;
    wrapper.appendChild(ul);

    if (this.menuContainer) {
      return this.menuContainer.appendChild(wrapper);
    }

    return this.range.getDocument().body.appendChild(wrapper);
  }

  showMenuFor(element, scrollTo) {
    // Check for maximum number of items added to the input for the specific Collection
    if (
      (this.current.collection.maxDisplayItems &&
        element.querySelectorAll(`[data-tribute-trigger="${this.current.collection.trigger}"]`).length >= this.current.collection.maxDisplayItems) ||
      this.current.collection.isBlocked
    ) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    this.currentMentionTextSnapshot = this.current.mentionText;

    // create the menu if it doesn't exist.
    if (!this.menu) {
      this.menu = this.createMenu(this.current.collection.containerClass);
      element.tributeMenu = this.menu;
      this.menuEvents.bind(this.menu);
    }

    this.isActive = true;
    this.menuSelected = 0;
    window.setTimeout(() => {
      this.menu.scrollTop = 0;
    }, 0);

    if (!this.current.mentionText) {
      this.current.mentionText = '';
    }

    const processValues = (values) => {
      // Tribute may not be active any more by the time the value callback returns
      if (!this.isActive) {
        return;
      }

      let items = this.search.filter(this.current.mentionText, values, {
        pre: this.current.collection.searchOpts.pre || '<span>',
        post: this.current.collection.searchOpts.post || '</span>',
        skip: this.current.collection.searchOpts.skip || false,
        caseSensitive: this.current.collection.searchOpts.caseSensitive || false,
        extract: (el) => {
          if (typeof this.current.collection.lookup === 'string') {
            return el[this.current.collection.lookup];
          }
          if (typeof this.current.collection.lookup === 'function') {
            return this.current.collection.lookup(el, this.current.mentionText);
          }
          throw new Error('Invalid lookup attribute, lookup must be string or function.');
        },
      });

      if (this.current.collection.menuItemLimit) {
        items = items.slice(0, this.current.collection.menuItemLimit);
      }

      this.current.filteredItems = items;

      const ul = this.menu.querySelector('ul');

      if (!items.length) {
        const noMatchEvent = new CustomEvent('tribute-no-match', {
          detail: this.menu,
        });
        this.current.element.dispatchEvent(noMatchEvent);
        if (
          (typeof this.current.collection.noMatchTemplate === 'function' && !this.current.collection.noMatchTemplate()) ||
          !this.current.collection.noMatchTemplate
        ) {
          this.hideMenu();
        } else {
          ul.innerHTML =
            typeof this.current.collection.noMatchTemplate === 'function' ? this.current.collection.noMatchTemplate() : this.current.collection.noMatchTemplate;
          this.range.positionMenuAtCaret(scrollTo);
        }

        return;
      }

      ul.innerHTML = '';
      const fragment = this.range.getDocument().createDocumentFragment();

      this.menuSelected = items.findIndex((item) => item.original.disabled !== true);

      items.forEach((item, index) => {
        const li = this.range.getDocument().createElement('li');
        li.setAttribute('data-index', index);
        if (item.original.disabled) li.setAttribute('data-disabled', 'true');
        li.className = this.current.collection.itemClass;
        li.addEventListener('mousemove', (e) => {
          const [li, index] = this._findLiTarget(e.target);
          if (e.movementY !== 0) {
            this.setActiveLi(index);
          }
        });
        if (this.menuSelected === index) {
          li.classList.add(this.current.collection.selectClass);
        }
        // remove all content in the li and append the content of menuItemTemplate
        const menuItemDomOrString = this.current.collection.menuItemTemplate(item);
        if (menuItemDomOrString instanceof Element) {
          li.innerHTML = '';
          li.appendChild(menuItemDomOrString);
        } else {
          li.innerHTML = menuItemDomOrString;
        }
        fragment.appendChild(li);
      });
      ul.appendChild(fragment);

      this.range.positionMenuAtCaret(scrollTo);
    };

    if (typeof this.current.collection.values === 'function') {
      if (this.current.collection.loadingItemTemplate) {
        this.menu.querySelector('ul').innerHTML = this.current.collection.loadingItemTemplate;
        this.range.positionMenuAtCaret(scrollTo);
      }

      this.current.collection.values(this.current.mentionText, processValues);
    } else {
      processValues(this.current.collection.values);
    }
  }

  _findLiTarget(el) {
    if (!el) return [];
    const index = el.getAttribute('data-index');
    return !index ? this._findLiTarget(el.parentNode) : [el, index];
  }

  showMenuForCollection(element, collectionIndex) {
    // Check for maximum number of items added to the input for the specific Collection
    if (
      (this.collection[collectionIndex || 0].maxDisplayItems &&
        element.querySelectorAll(`[data-tribute-trigger="${this.collection[collectionIndex || 0].trigger}"]`).length >=
          this.collection[collectionIndex || 0].maxDisplayItems) ||
      this.collection[collectionIndex || 0].isBlocked
    ) {
      //console.log("Tribute: Maximum number of items added!");
      return;
    }

    if (element !== document.activeElement) {
      this.placeCaretAtEnd(element);
    }

    this.current.collection = this.collection[collectionIndex || 0];
    this.current.externalTrigger = true;
    this.current.element = element;

    if (element.isContentEditable) this.insertTextAtCursor(this.current.collection.trigger);
    else this.insertAtCaret(element, this.current.collection.trigger);

    this.showMenuFor(element);
  }

  // TODO: make sure this works for inputs/textareas
  placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (typeof document.body.createTextRange !== 'undefined') {
      const textRange = document.body.createTextRange();
      textRange.moveToElementText(el);
      textRange.collapse(false);
      textRange.select();
    }
  }

  // for contenteditable
  insertTextAtCursor(text) {
    let html;
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.selectNodeContents(textNode);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // for regular inputs
  insertAtCaret(textarea, text) {
    const scrollPos = textarea.scrollTop;
    let caretPos = textarea.selectionStart;

    const front = textarea.value.substring(0, caretPos);
    const back = textarea.value.substring(textarea.selectionEnd, textarea.value.length);
    textarea.value = front + text + back;
    caretPos = caretPos + text.length;
    textarea.selectionStart = caretPos;
    textarea.selectionEnd = caretPos;
    textarea.focus();
    textarea.scrollTop = scrollPos;
  }

  hideMenu() {
    if (this.menu) {
      this.menu.style.cssText = 'display: none;';
      this.isActive = false;
      this.menuSelected = 0;
      this.current = {};
    }
  }

  selectItemAtIndex(index, originalEvent) {
    const _index = Number.parseInt(index);
    if (typeof _index !== 'number' || Number.isNaN(_index) || !this.current.filteredItems) return;
    const item = this.current.filteredItems[_index];
    const content = this.current.collection.selectTemplate(item);

    if (_index === -1) {
      const selectedNoMatchEvent = new CustomEvent('tribute-selected-no-match', { detail: content });
      this.current.element.dispatchEvent(selectedNoMatchEvent);
      return;
    }

    if (content !== null) this.replaceText(content, originalEvent, item);
  }

  replaceText(content, originalEvent, item) {
    this.range.replaceTriggerText(content, true, true, originalEvent, item);
  }

  _append(collection, newValues, replace) {
    if (typeof collection.values === 'function') {
      throw new Error('Unable to append to values, as it is a function.');
    }
    if (!replace) {
      collection.values = collection.values.concat(newValues);
    } else {
      collection.values = newValues;
    }
  }

  append(collectionIndex, newValues, replace) {
    const index = Number.parseInt(collectionIndex);
    if (typeof index !== 'number') throw new Error('please provide an index for the collection to update.');

    const collection = this.collection[index];

    this._append(collection, newValues, replace);
  }

  appendCurrent(newValues, replace) {
    if (this.isActive) {
      this._append(this.current.collection, newValues, replace);
    } else {
      throw new Error('No active state. Please use append instead and pass an index.');
    }
  }

  detach(el) {
    if (!el) {
      throw new Error('[Tribute] Must pass in a DOM node or NodeList.');
    }

    // Check if it is a jQuery collection
    const _el = typeof jQuery !== 'undefined' && el instanceof jQuery ? el.get() : el;

    // Is el an Array/Array-like object?
    if (_el.constructor === NodeList || _el.constructor === HTMLCollection || _el.constructor === Array) {
      const length = _el.length;
      for (let i = 0; i < length; ++i) {
        this._detach(_el[i]);
      }
    } else {
      this._detach(_el);
    }
  }

  _detach(el) {
    this.events.unbind(el);
    if (el.tributeMenu) {
      this.menuEvents.unbind(el.tributeMenu);
    }

    setTimeout(() => {
      el.removeAttribute('data-tribute');
      this.isActive = false;
      if (el.tributeMenu) {
        el.tributeMenu.remove();
      }
    });
  }

  setActiveLi(index) {
    const lis = this.menu.querySelectorAll('li');
    const length = lis.length >>> 0;

    if (index) {
      this.menuSelected = Number.parseInt(index);
    }

    for (let i = 0; i < length; i++) {
      const li = lis[i];
      if (i === this.menuSelected) {
        if (li.getAttribute('data-disabled') !== 'true') {
          li.classList.add(this.current.collection.selectClass);
        }

        const liClientRect = li.getBoundingClientRect();
        const menuClientRect = this.menu.getBoundingClientRect();

        if (liClientRect.bottom > menuClientRect.bottom) {
          const scrollDistance = liClientRect.bottom - menuClientRect.bottom;
          this.menu.scrollTop += scrollDistance;
        } else if (liClientRect.top < menuClientRect.top) {
          const scrollDistance = menuClientRect.top - liClientRect.top;
          this.menu.scrollTop -= scrollDistance;
        }
      } else {
        li.classList.remove(this.current.collection.selectClass);
      }
    }
  }
}

function defaultSelectTemplate(tribute, item) {
  if (typeof item === 'undefined') return `${tribute.current.collection.trigger}${tribute.current.mentionText}`;

  if (tribute.range.isContentEditable(tribute.current.element)) {
    return `<span class="tribute-mention">${tribute.current.collection.trigger + item.original[tribute.current.collection.fillAttr]}</span>`;
  }

  return tribute.current.collection.trigger + item.original[tribute.current.collection.fillAttr];
}

function defaultMenuItemTemplate(matchItem) {
  return matchItem.string;
}

export default Tribute;
