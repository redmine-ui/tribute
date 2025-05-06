// Thanks to https://github.com/mattyork/fuzzy
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
    const _opts = opts || {};
    const pre = _opts.pre || '';
    const post = _opts.post || '';
    const compareString = (_opts.caseSensitive && string) || string.toLowerCase();

    if (_opts.skip) {
      return { rendered: string, score: 0 };
    }

    const _pattern = (_opts.caseSensitive && pattern) || pattern.toLowerCase();

    const patternCache = this.traverse(compareString, _pattern, 0, 0, []);
    if (!patternCache) {
      return null;
    }
    return {
      rendered: this.render(string, patternCache.cache, pre, post),
      score: patternCache.score,
    };
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

  render(string: string, indices: number[], pre: string, post: string) {
    let rendered = string.substring(0, indices[0]);

    indices.forEach((index, i) => {
      rendered += pre + string[index] + post + string.substring(index + 1, indices[i + 1] ? indices[i + 1] : string.length);
    });

    return rendered;
  }

  filter(pattern: string, arr: T[], opts?: TributeSearchOpts<T>) {
    const _opts = opts || {};
    return arr
      .reduce((prev: TributeItem<T>[], element: T, idx: number, arr) => {
        let str: string | T | null | undefined = element;

        if (_opts.extract) {
          str = _opts.extract(element);

          if (!str) {
            // take care of undefineds / nulls / etc.
            str = '';
          }
        }

        const rendered = typeof str === 'string' ? this.match(pattern, str, _opts) : null;

        if (rendered != null) {
          prev[prev.length] = {
            string: rendered.rendered,
            score: rendered.score,
            index: idx,
            original: element,
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

export default TributeSearch;
