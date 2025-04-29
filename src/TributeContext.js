class TributeContext {
  constructor(tribute) {
    this.tribute = tribute;
  }

  process(scrollTo) {
    const ul = this.tribute.menu.element.querySelector('ul');
    const processor = (values) => {
      // Tribute may not be active any more by the time the value callback returns
      if (!this.tribute.isActive) {
        return;
      }

      const items = this._filterItems(values);
      this.filteredItems = items;

      if (!items.length) {
        this._handleNoItem(ul, scrollTo);
      } else {
        this._renderMenu(items, ul, scrollTo);
      }
    };

    if (typeof this.collection.values === 'function') {
      if (this.collection.loadingItemTemplate) {
        ul.innerHTML = this.collection.loadingItemTemplate;
        this.tribute.range.positionMenuAtCaret(scrollTo);
      }

      this.collection.values(this.mentionText, processor);
    } else {
      processor(this.collection.values);
    }
  }

  updateSelection(info) {
    this.selectedPath = info.mentionSelectedPath;
    this.mentionText = info.mentionText;
    this.selectedOffset = info.mentionSelectedOffset;
  }

  get isMentionLengthUnderMinimum() {
    if (!this.collection) return undefined;

    return this.mentionText.length < this.collection.menuShowMinLength;
  }

  _filterItems(values) {
    const opts = this.collection.searchOpts;
    const lookup = this.collection.lookup;
    const items = this.tribute.search.filter(this.mentionText, values, {
      pre: opts.pre || '<span>',
      post: opts.post || '</span>',
      skip: opts.skip || false,
      caseSensitive: opts.caseSensitive || false,
      extract: (el) => {
        if (typeof lookup === 'string') {
          return el[lookup];
        }
        if (typeof lookup === 'function') {
          return lookup(el, this.mentionText);
        }
        throw new Error('Invalid lookup attribute, lookup must be string or function.');
      },
    });

    if (this.collection.menuItemLimit) {
      return items.slice(0, this.collection.menuItemLimit);
    }

    return items;
  }

  _handleNoItem(ul, scrollTo) {
    const noMatchEvent = new CustomEvent('tribute-no-match', {
      detail: this.tribute.menu.element,
    });
    this.element.dispatchEvent(noMatchEvent);
    if ((typeof this.collection.noMatchTemplate === 'function' && !this.collection.noMatchTemplate()) || !this.collection.noMatchTemplate) {
      this.tribute.hideMenu();
    } else {
      ul.innerHTML = typeof this.collection.noMatchTemplate === 'function' ? this.collection.noMatchTemplate() : this.collection.noMatchTemplate;
      this.tribute.range.positionMenuAtCaret(scrollTo);
    }
  }

  _renderMenu(items, ul, scrollTo) {
    ul.innerHTML = '';
    const doc = this.tribute.range.getDocument();
    const fragment = doc.createDocumentFragment();

    this.tribute.menu.selected = items.findIndex((item) => item.original.disabled !== true);

    items.forEach((item, index) => {
      const li = this._createMenuItem(item, index, doc);
      fragment.appendChild(li);
    });
    ul.appendChild(fragment);

    this.tribute.range.positionMenuAtCaret(scrollTo);
  }

  _createMenuItem(item, index, doc) {
    const li = doc.createElement('li');
    li.setAttribute('data-index', index);
    if (item.original.disabled) {
      li.setAttribute('data-disabled', 'true');
    }
    li.className = this.collection.itemClass;
    li.addEventListener('mousemove', (e) => {
      const [li, index] = this._findLiTarget(e.target);
      if (e.movementY !== 0) {
        this.tribute.menu.setActiveLi(index);
      }
    });
    if (this.tribute.menu.selected === index) {
      li.classList.add(this.collection.selectClass);
    }
    // remove all content in the li and append the content of menuItemTemplate
    const menuItemDomOrString = this.collection.menuItemTemplate(item);
    if (menuItemDomOrString instanceof Element) {
      li.innerHTML = '';
      li.appendChild(menuItemDomOrString);
    } else {
      li.innerHTML = menuItemDomOrString;
    }
    return li;
  }

  _findLiTarget(el) {
    if (!el) return [];
    const index = el.getAttribute('data-index');
    return !index ? this._findLiTarget(el.parentNode) : [el, index];
  }
}

export default TributeContext;
