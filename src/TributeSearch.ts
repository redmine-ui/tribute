// Thanks to https://github.com/mattyork/fuzzy

import { defaultSeachOpts } from './collection';
import type { HtmlHelper } from './html';
import type { ITribute, ITributeSearch, TributeItem, TributeSearchOpts } from './type';

class TributeSearch<T extends {}> implements ITributeSearch<T> {
  tribute: ITribute<T>;

  constructor(tribute: ITribute<T>) {
    this.tribute = tribute;
  }

  simpleFilter(pattern: string, array: string[]) {
    return array.filter((string) => {
      return this.test(pattern, string);
    });
  }

  test(pattern: string, string: string) {
    return this.match(pattern, string) !== null;
  }

  match(pattern: string, string: string, opts?: TributeSearchOpts<T>) {
    const _opts = opts || defaultSeachOpts();
    const segmentsOf = (indices: number[]) => ({ segments: toSegments(string, indices) });
    if (_opts.skip) return { ...segmentsOf([]), score: 0 };

    const compareString = (_opts.caseSensitive && string) || string.toLowerCase();
    const _pattern = (_opts.caseSensitive && pattern) || pattern.toLowerCase();

    const patternCache = this.traverse(compareString, _pattern, 0, 0, []);

    if (!patternCache) return null;
    return { ...segmentsOf(patternCache.cache), score: patternCache.score };
  }

  traverse(string: string, pattern: string, stringIndex: number, patternIndex: number, patternCache: number[]): { score: number; cache: number[] } | undefined {
    // if the pattern search at end
    const _pattern = this.tribute.autocompleteSeparator ? pattern.split(this.tribute.autocompleteSeparator).splice(-1)[0] : pattern;
    if (typeof _pattern === 'undefined') return;

    if (_pattern.length === patternIndex) {
      // calculate score and copy the cache containing the indices where it's found
      return {
        score: this.calculateScore(patternCache),
        cache: patternCache.slice(),
      };
    }

    // if string at end or remaining pattern > remaining string
    if (string.length === stringIndex || _pattern.length - patternIndex > string.length - stringIndex) {
      return undefined;
    }

    const c = _pattern[patternIndex];
    if (!c) return;
    let index = string.indexOf(c, stringIndex);
    let best: { score: number; cache: number[] } | undefined;
    let temp: { score: number; cache: number[] } | undefined;

    while (index > -1) {
      patternCache.push(index);
      temp = this.traverse(string, pattern, index + 1, patternIndex + 1, patternCache);
      patternCache.pop();

      // if downstream traversal failed, return best answer so far
      if (!temp) {
        return best;
      }

      if (!best || best.score < temp.score) {
        best = temp;
      }

      index = string.indexOf(c, index + 1);
    }

    return best;
  }

  calculateScore(patternCache: number[]) {
    let score = 0;
    let temp = 1;

    patternCache.forEach((index, i) => {
      if (i > 0) {
        const prev = patternCache[i - 1];
        if (typeof prev !== 'undefined' && prev + 1 === index) {
          temp += 1;
        } else {
          temp = 1;
        }
      }

      score += temp;
    });

    return score;
  }

  filter(pattern: string, arr: T[], opts: TributeSearchOpts<T>, htmlHelper: HtmlHelper) {
    const _opts = opts;
    return arr
      .reduce((prev: TributeItem<T>[], element: T, idx: number, _arr) => {
        let str: string | T | null | undefined = element;

        if (_opts.extract) {
          str = _opts.extract(element);

          if (!str) {
            // take care of undefineds / nulls / etc.
            str = '';
          }
        }

        const rendered = typeof str === 'string' ? this.match(pattern, str, _opts) : null;

        if (rendered !== null) {
          prev[prev.length] = {
            index: idx,
            original: element,
            score: rendered.score,
            get string() {
              return renderString(rendered.segments, _opts.pre, _opts.post);
            },
            get html() {
              return renderFragment(rendered.segments, htmlHelper, _opts.wrap);
            },
          };
        }

        return prev;
      }, [])

      .sort((a: TributeItem<T>, b: TributeItem<T>) => {
        const compare = b.score - a.score;
        if (compare) return compare;
        return a.index - b.index;
      });
  }
}

type Segment = { text: string; matched: boolean };

function toSegments(text: string, indices: number[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const index of indices) {
    if (index > cursor) {
      segments.push({ text: text.substring(cursor, index), matched: false });
    }
    if (text[index] !== undefined) {
      segments.push({ text: text[index], matched: true });
    }
    cursor = index + 1;
  }
  if (cursor < text.length) segments.push({ text: text.substring(cursor), matched: false });
  return segments;
}

function escapeHtml(str: string): string {
  return str.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[ch] ?? ch,
  );
}

function renderString(segments: Segment[], pre: string, post: string): string {
  return segments.map(({ text, matched }) => (matched ? pre + escapeHtml(text) + post : escapeHtml(text))).join('');
}

function renderFragment(segments: Segment[], html: HtmlHelper, wrap?: (text?: string) => Node): DocumentFragment {
  if (wrap === undefined) throw new Error();

  return html.f(...segments.map(({ text, matched }) => (matched ? wrap(text) : text)));
}

export default TributeSearch;
