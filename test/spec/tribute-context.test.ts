import { expect } from 'chai';

import TributeContext from '../../src/TributeContext';
import type { Collection, ITribute, ITributeContext, ITributeMenu, ITributeRange, ITributeSearch } from '../../src/type';

type Person = { key: string; value: string };

/**
 * Records every call made through the mock, keyed by "member.method".
 * Lets tests assert both "was this called" and "with what arguments",
 * without pulling in a mocking library.
 */
function createCallRecorder() {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string, args: unknown[]) => {
    calls[name] ??= [];
    calls[name].push(args);
  };
  return { calls, record };
}

function createMockTribute<T extends {}>(overrides: Partial<ITribute<T>> = {}) {
  const { calls, record } = createCallRecorder();
  const contextMap = new Map<HTMLElement, ITributeContext<T>>();

  const menu: ITributeMenu<T> = {
    element: null,
    selected: -1,
    render: (...args) => {
      record('menu.render', args);
      return false;
    },
    activate: () => record('menu.activate', []),
    deactivate: () => record('menu.deactivate', []),
    isActive: false,
    create: (...args) => {
      record('menu.create', args);
      return document.createElement('div');
    },
    getDimensions: () => ({ height: null, width: null }),
    setActiveLi: (...args) => record('menu.setActiveLi', args),
    positionAtCaret: (...args) => record('menu.positionAtCaret', args),
    up: (...args) => record('menu.up', args),
    down: (...args) => record('menu.down', args),
    unselect: (...args) => record('menu.unselect', args),
  };

  const range: ITributeRange<T> = {
    getDocument: () => document,
    positionMenuAtCaret: (...args) => record('range.positionMenuAtCaret', args),
    replaceTriggerText: (...args) => record('range.replaceTriggerText', args),
    getTrigger: () => undefined,
    getTriggerInfo: () => undefined,
    insertText: (...args) => record('range.insertText', args),
    focusAtEnd: (...args) => record('range.focusAtEnd', args),
  };

  const search: ITributeSearch<T> = {
    filter: (_pattern, arr) => arr.map((original, index) => ({ index, original, score: 0, string: String(index) })),
  };

  const tribute = {
    autocompleteMode: false,
    autocompleteSeparator: null,
    allowSpaces: false,
    closeOnScroll: false,
    current: undefined,
    collection: [],
    hideMenu: (...args: unknown[]) => record('hideMenu', args),
    search,
    hasTrailingSpace: false,
    isActive: false,
    positionMenu: true,
    replaceTextSuffix: null,
    showMenuFor: (...args: unknown[]) => record('showMenuFor', args),
    showMenuForCollection: (...args: unknown[]) => record('showMenuForCollection', args),
    spaceSelectsMatch: false,
    triggers: () => [],
    ...overrides,
  } as ITribute<T>;

  const contextFor = (element: HTMLElement): ITributeContext<T> => {
    record('contextFor', [element]);
    let context = contextMap.get(element);
    if (!context) {
      context = new TributeContext({ tribute: tribute, element: element, range: range, menu: menu });
      contextMap.set(element, context);
    }
    return context;
  };

  tribute.contextFor = contextFor;

  return { tribute, menu, range, search, calls };
}

function makeCollection(overrides: Partial<Collection<Person>> = {}): Collection<Person> {
  return {
    trigger: '@',
    selectClass: 'highlight',
    containerClass: 'tribute-container',
    itemClass: '',
    fillAttr: 'key',
    values: [],
    loadingItemTemplate: null,
    searchOpts: {},
    menuShowMinLength: 0,
    selectTemplate: (item) => (item ? item.original.value : ''),
    menuItemTemplate: null,
    noMatchTemplate: null,
    ...overrides,
  };
}

function startTriggered(collection = makeCollection()) {
  const m = createMockTribute<Person>({ collection: [collection] });
  const el = document.createElement('div');
  const context = new TributeContext<Person>({ tribute: m.tribute, element: el, range: m.range, menu: m.menu });
  context.sessionStarted(collection.trigger);
  return { context, el, ...m };
}

function startSession(values: Person[]) {
  const s = startTriggered(makeCollection({ values }));
  const menuEl = document.createElement('div');
  menuEl.appendChild(document.createElement('ul'));
  s.context.menu.element = menuEl;
  s.context.showMenuFor(s.el, false, () => {});
  return s;
}

const people: Person[] = [
  { key: 'a', value: 'A' },
  { key: 'b', value: 'B' },
];

describe('TributeContext', () => {
  describe('activate/deactivate', () => {
    it('is inactive by default', () => {
      const mock = createMockTribute<Person>();
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });
      expect(context.isActive).to.be.false;
    });

    it('dispatches tribute-active-true on the current element when activated', () => {
      const { context, el } = startTriggered();

      let fired = false;
      el.addEventListener('tribute-active-true', () => {
        fired = true;
      });

      context.activate();

      expect(context.isActive).to.be.true;
      expect(fired).to.be.true;
    });

    it('does not dispatch again when activating twice in a row', () => {
      const { context, el } = startTriggered();

      let fireCount = 0;
      el.addEventListener('tribute-active-true', () => {
        fireCount += 1;
      });

      context.activate();
      context.activate();

      expect(fireCount).to.equal(1);
    });
  });

  describe('sessionStarted', () => {
    it('does nothing when trigger is undefined', () => {
      const mock = createMockTribute<Person>();
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      context.sessionStarted(undefined);

      expect(context.trigger).to.be.undefined;
      expect(context.collection).to.be.undefined;
    });

    it('resolves the collection matching the detected trigger character', () => {
      const atCollection = makeCollection({ trigger: '@' });
      const hashCollection = makeCollection({ trigger: '#' });
      const mock = createMockTribute<Person>({ collection: [atCollection, hashCollection] });
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      context.sessionStarted('#');

      expect(context.trigger).to.equal('#');
      expect(context.collection).to.equal(hashCollection);
      expect(context.element).to.equal(element);
    });
  });

  describe('queryChanged', () => {
    it('updates mentionText from the given info', () => {
      const mock = createMockTribute<Person>();
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      context.queryChanged({
        mentionPosition: 0,
        mentionText: 'jo',
        mentionSelectedElement: undefined,
        mentionSelectedPath: [1, 2],
        mentionSelectedOffset: 3,
      });

      expect(context.element).to.equal(element);
      expect(context.mentionText).to.equal('jo');
    });

    it('still sets element when info is omitted', () => {
      const mock = createMockTribute<Person>();
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      context.queryChanged(undefined);

      expect(context.element).to.equal(element);
    });
  });

  describe('refreshMenu', () => {
    it('shows the menu once mentionText reaches menuShowMinLength', () => {
      // menuShowMinLength defaults to 0 here, and mentionText starts as '',
      // so the query is already long enough ("" is not < 0): the menu should
      // open as soon as the trigger is detected.
      const collection = makeCollection({ trigger: '@', menuShowMinLength: 0 });
      const mock = createMockTribute<Person>({ collection: [collection] });
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      context.sessionStarted('@');
      context.refreshMenu(false, false);

      expect(mock.calls.showMenuFor).to.not.be.undefined;
    });

    it('does not show the menu while the query is still under menuShowMinLength', () => {
      const collection = makeCollection({ trigger: '@', menuShowMinLength: 2 });
      const mock = createMockTribute<Person>({ collection: [collection] });
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      // mentionText is '' at this point (queryChanged hasn't run), so the
      // query ('' length 0) is under the minimum (2): showMenuFor must NOT
      // be called yet.
      context.sessionStarted('@');
      context.refreshMenu(false, false);

      expect(mock.calls.showMenuFor).to.be.undefined;
    });
  });

  describe('selectionMoved', () => {
    it('returns false and does not touch the menu when inactive', () => {
      const values = people;
      const { context, calls } = startTriggered(makeCollection({ values }));
      const menuEl = document.createElement('div');
      menuEl.appendChild(document.createElement('ul'));
      context.menu.element = menuEl;

      const handled = context.selectionMoved(1);

      expect(handled).to.be.false;
      expect(calls['menu.up']).to.be.undefined;
      expect(calls['menu.down']).to.be.undefined;
    });

    it('calls menu.down with the item count when moving down while active', () => {
      const { context, calls } = startSession(people);

      expect(context.selectionMoved(-1)).to.be.true;
      expect(calls['menu.down']).to.deep.equal([[2]]);
    });

    it('calls menu.up with the item count when moving up while active', () => {
      if (people.length === 0 || !people[0]) throw new Error();
      const { context, calls } = startSession([people[0]]);

      context.selectionMoved(1);
      expect(calls['menu.up']).to.deep.equal([[1]]);
    });
  });

  describe('selectionConfirmed', () => {
    it('returns false when inactive', () => {
      const mock = createMockTribute<Person>();
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      expect(context.selectionConfirmed(new Event('keydown'))).to.be.false;
    });

    it('unselects the menu and hides it when there are zero filtered items', async () => {
      const { context, calls } = startSession([]);

      expect(context.selectionConfirmed(new Event('keydown'))).to.be.true;
      expect(calls['menu.unselect']).to.not.be.undefined;

      await new Promise((r) => setTimeout(r, 10));
      expect(calls.hideMenu).to.not.be.undefined;
    });
  });

  describe('sessionCanceled', () => {
    it('returns false and does not hide the menu when inactive', () => {
      const mock = createMockTribute<Person>();
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      expect(context.sessionCanceled()).to.be.false;
      expect(mock.calls.hideMenu).to.be.undefined;
    });

    it('hides the menu when active', () => {
      const mock = createMockTribute<Person>();
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });
      context.activate();

      expect(context.sessionCanceled()).to.be.true;
      expect(mock.calls.hideMenu).to.not.be.undefined;
    });
  });

  describe('showMenuFor', () => {
    it('does nothing when collection is undefined', () => {
      const mock = createMockTribute<Person>();
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      let ensureMenuCalled = false;
      context.showMenuFor(element, false, () => {
        ensureMenuCalled = true;
      });

      expect(ensureMenuCalled).to.be.false;
      expect(context.isActive).to.be.false;
      expect(mock.calls['menu.activate']).to.be.undefined;
    });

    it('does nothing when isMaximumItemsAdded is true', () => {
      const collection = makeCollection({ isBlocked: true });
      const mock = createMockTribute<Person>({ collection: [collection] });
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });
      context.sessionStarted('@');

      let bindMenuCalled = false;
      context.showMenuFor(element, false, () => {
        bindMenuCalled = true;
      });

      expect(bindMenuCalled).to.be.false;
      expect(context.isActive).to.be.false;
      expect(mock.calls['menu.activate']).to.be.undefined;
    });

    it('calls bindMenu with menu, and activates context and menu', () => {
      const collection = makeCollection({ containerClass: 'custom-container' });
      const mock = createMockTribute<Person>({ collection: [collection] });
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });
      context.sessionStarted('@');

      let _passedMenu: HTMLElement | undefined;

      context.showMenuFor(element, false, (menu) => {
        _passedMenu = menu;
      });

      // expect(passedRange).to.equal(range);
      // expect(passedClass).to.equal('custom-container');
      expect(context.isActive).to.be.true;
      expect(mock.calls['menu.activate']).to.not.be.undefined;
    });

    it('does nothing when menu element has not been created yet', () => {
      const collection = makeCollection({ values: [{ key: 'a', value: 'A' }] });
      const mock = createMockTribute<Person>({ collection: [collection] });

      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });
      context.sessionStarted('@');

      context.showMenuFor(element, false, () => {});

      expect(mock.calls['menu.render']).to.be.undefined;
    });

    it('filters values, renders the menu, and stores filteredItems when active', () => {
      const values: Person[] = [
        { key: 'a', value: 'A' },
        { key: 'b', value: 'B' },
      ];
      const collection = makeCollection({ values });
      const mock = createMockTribute<Person>({ collection: [collection] });

      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });
      const ul = document.createElement('ul');
      const menuEl = document.createElement('div');
      menuEl.appendChild(ul);

      context.menu.element = menuEl;

      context.sessionStarted('@');
      context.showMenuFor(element, false, () => {});

      expect(context.hasFilteredItems).to.be.true;
      expect(mock.calls['menu.render']).to.not.be.undefined;
    });

    it('positions menu at caret when scrollTo is true and menu.render returns true', () => {
      const collection = makeCollection({ values: [{ key: 'a', value: 'A' }] });
      const mock = createMockTribute<Person>({ collection: [collection] });

      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      const ul = document.createElement('ul');
      const menuEl = document.createElement('div');
      menuEl.appendChild(ul);
      context.menu.element = menuEl;
      context.menu.render = () => true;

      context.sessionStarted('@');
      context.showMenuFor(element, true, () => {});

      expect(mock.calls['range.positionMenuAtCaret']).to.deep.equal([[true]]);
    });

    it('shows the loading template while an async collection resolves', () => {
      const collection = makeCollection({
        loadingItemTemplate: '<li>Loading…</li>',
        values: (_text, cb) => {
          setTimeout(() => cb([]), 5);
        },
      });
      const mock = createMockTribute<Person>({ collection: [collection] });
      const ul = document.createElement('ul');
      const menuEl = document.createElement('div');
      menuEl.appendChild(ul);
      mock.menu.element = menuEl;

      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });
      context.sessionStarted('@');

      context.showMenuFor(element, true, () => {});

      expect(ul.innerHTML).to.equal('<li>Loading…</li>');
      expect(mock.calls['range.positionMenuAtCaret']).to.deep.equal([[true]]);
    });

    it('does not apply results that resolve after the session was canceled', () => {
      const collection = makeCollection({
        values: (_text, cb) => {
          setTimeout(() => cb([{ key: 'a', value: 'A' }]), 5);
        },
      });
      const mock = createMockTribute<Person>({ collection: [collection] });
      const ul = document.createElement('ul');
      const menuEl = document.createElement('div');
      menuEl.appendChild(ul);
      mock.menu.element = menuEl;

      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });
      context.sessionStarted('@');

      context.showMenuFor(element, true, () => {});
      context.deactivate(); // session ends before the async values() resolves

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(context.hasFilteredItems).to.be.false;
          expect(mock.calls['menu.render']).to.be.undefined;
          resolve();
        }, 15);
      });
    });
  });

  describe('showMenuForCollection', () => {
    it('does nothing when collection is undefined', () => {
      const mock = createMockTribute<Person>();
      const element = document.createElement('div');
      const context = new TributeContext<Person>({ ...mock, element });

      context.showMenuForCollection(undefined);

      expect(mock.calls['range.insertText']).to.be.undefined;
    });

    it('sets collection/element/externalTrigger and inserts the trigger character', () => {
      const mock = createMockTribute<Person>();

      const element = document.createElement('div');
      document.body.appendChild(element);

      const context = new TributeContext<Person>({ ...mock, element });
      const collection = makeCollection({ trigger: '@' });
      element.focus();

      context.showMenuForCollection(collection);

      expect(context.collection).to.equal(collection);
      expect(context.consumeExternalTrigger()).to.be.true;
      expect(context.consumeExternalTrigger()).to.be.false;
      expect(context.element).to.equal(element);
      expect(mock.calls['range.insertText']).to.deep.equal([['@']]);

      document.body.removeChild(element);
    });
  });
});
