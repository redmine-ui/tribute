import { expect } from 'chai';

import { query } from '../../src/collection';
import type { Collection, ITributeSearch, TributeItem } from '../../src/type';

type Person = { key: string; value: string };

// query() only needs a handful of Collection fields; the rest of the shape
// is filled in with harmless defaults so each test can override just what
// it cares about.
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
    selectTemplate: null,
    menuItemTemplate: null,
    noMatchTemplate: null,
    ...overrides,
  };
}

// A stub search that never does real fuzzy matching: it just wraps every
// value it's given into a TributeItem and records how it was called, so
// tests can assert on what query() actually passed through.
function makeSearchSpy<T extends {}>() {
  const calls: { pattern: string; arr: T[]; opts?: Parameters<ITributeSearch<T>['filter']>[2] }[] = [];
  const search: ITributeSearch<T> = {
    filter(pattern, arr, opts) {
      calls.push({ pattern, arr, opts });
      return arr.map((original, index) => ({ index, original, score: 0, string: String(index) }));
    },
  };
  return { search, calls };
}

describe('Collection#query', () => {
  it('resolves synchronous array values through search.filter and forwards the result', () => {
    const values: Person[] = [{ key: 'a', value: 'A' }, { key: 'b', value: 'B' }];
    const collection = makeCollection({ values });
    const { search, calls } = makeSearchSpy<Person>();

    let result: TributeItem<Person>[] | undefined;
    query(collection, search, 'a', (items) => {
      result = items;
    });

    expect(calls).to.have.lengthOf(1);
    expect(calls[0].pattern).to.equal('a');
    expect(calls[0].arr).to.equal(values);
    expect(result).to.not.equal(undefined);
    expect(result).to.have.lengthOf(2);
  });

  it('does not invoke the callback when values is null', () => {
    const collection = makeCollection({ values: null });
    const { search } = makeSearchSpy<Person>();

    let called = false;
    query(collection, search, 'a', () => {
      called = true;
    });

    expect(called).to.equal(false);
  });

  it('calls the async values function and forwards whatever it resolves with', () => {
    const values: Person[] = [{ key: 'c', value: 'C' }];
    const collection = makeCollection({
      values: (_text, cb) => {
        setTimeout(() => cb(values), 0);
      },
    });
    const { search } = makeSearchSpy<Person>();

    return new Promise<void>((resolve) => {
      query(collection, search, 'c', (items) => {
        expect(items).to.have.lengthOf(1);
        resolve();
      });
    });
  });

  it('falls back to default pre/post/skip/caseSensitive when searchOpts omits them', () => {
    const collection = makeCollection({ values: [{ key: 'a', value: 'A' }], searchOpts: {} });
    const { search, calls } = makeSearchSpy<Person>();

    query(collection, search, 'a', () => {});

    expect(calls[0].opts?.pre).to.equal('<span>');
    expect(calls[0].opts?.post).to.equal('</span>');
    expect(calls[0].opts?.skip).to.equal(false);
    expect(calls[0].opts?.caseSensitive).to.equal(false);
  });

  it('passes through explicit searchOpts instead of the defaults', () => {
    const collection = makeCollection({
      values: [{ key: 'a', value: 'A' }],
      searchOpts: { pre: '<b>', post: '</b>', skip: true, caseSensitive: true },
    });
    const { search, calls } = makeSearchSpy<Person>();

    query(collection, search, 'a', () => {});

    expect(calls[0].opts?.pre).to.equal('<b>');
    expect(calls[0].opts?.post).to.equal('</b>');
    expect(calls[0].opts?.skip).to.equal(true);
    expect(calls[0].opts?.caseSensitive).to.equal(true);
  });

  it('extracts via a string lookup', () => {
    const item: Person = { key: 'a', value: 'Alpha' };
    const collection = makeCollection({ values: [item], lookup: 'value' });
    const { search, calls } = makeSearchSpy<Person>();

    query(collection, search, 'a', () => {});

    expect(calls[0].opts?.extract?.(item)).to.equal('Alpha');
  });

  it('extracts via a function lookup, passing the mention text through', () => {
    const item: Person = { key: 'a', value: 'Alpha' };
    const collection = makeCollection({
      values: [item],
      lookup: (el, mentionText) => `${el.value}:${mentionText}`,
    });
      const { search, calls } = makeSearchSpy<Person>();

      query(collection, search, 'query-text', () => {});

      expect(calls[0].opts?.extract?.(item)).to.equal('Alpha:query-text');
  });

  it('throws from extract when lookup is neither a string nor a function', () => {
    const item: Person = { key: 'a', value: 'Alpha' };
    const collection = makeCollection({ values: [item], lookup: undefined });
    const { search, calls } = makeSearchSpy<Person>();

    query(collection, search, 'a', () => {});

    expect(() => calls[0].opts?.extract?.(item)).to.throw('Invalid lookup attribute');
  });

  it('truncates the results to menuItemLimit when set', () => {
    const values: Person[] = [
      { key: 'a', value: 'A' },
      { key: 'b', value: 'B' },
      { key: 'c', value: 'C' },
    ];
    const collection = makeCollection({ values, menuItemLimit: 2 });
    const { search } = makeSearchSpy<Person>();

    let result: TributeItem<Person>[] = [];
    query(collection, search, 'a', (items) => {
      result = items;
    });

    expect(result).to.have.lengthOf(2);
  });

  it('does not truncate when menuItemLimit is unset', () => {
    const values: Person[] = [
      { key: 'a', value: 'A' },
      { key: 'b', value: 'B' },
      { key: 'c', value: 'C' },
    ];
    const collection = makeCollection({ values });
    const { search } = makeSearchSpy<Person>();

    let result: TributeItem<Person>[] = [];
    query(collection, search, 'a', (items) => {
      result = items;
    });

    expect(result).to.have.lengthOf(3);
  });
});
