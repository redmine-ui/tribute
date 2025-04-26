// Thanks to https://github.com/mattyork/fuzzy
class TributeSearch {
  constructor(tribute) {
    this.tribute = tribute;
  }

  simpleFilter(pattern, array) {
    return array.filter((string) => {
      return this.test(pattern, string);
    });
  }

  test(pattern, string) {
    return this.match(pattern, string) !== null;
  }

  match(pattern, string, opts) {
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

  traverse(string, pattern, stringIndex, patternIndex, patternCache) {
    // if the pattern search at end
    const _pattern = this.tribute.autocompleteSeparator ? pattern.split(this.tribute.autocompleteSeparator).splice(-1)[0] : pattern;

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
    let index = string.indexOf(c, stringIndex);
    let best;
    let temp;

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

  calculateScore(patternCache) {
    let score = 0;
    let temp = 1;

    patternCache.forEach((index, i) => {
      if (i > 0) {
        if (patternCache[i - 1] + 1 === index) {
          temp += 1;
        } else {
          temp = 1;
        }
      }

      score += temp;
    });

    return score;
  }

  render(string, indices, pre, post) {
    let rendered = string.substring(0, indices[0]);

    indices.forEach((index, i) => {
      rendered += pre + string[index] + post + string.substring(index + 1, indices[i + 1] ? indices[i + 1] : string.length);
    });

    return rendered;
  }

  filter(pattern, arr, opts) {
    const _opts = opts || {};
    return arr
      .reduce((prev, element, idx, arr) => {
        let str = element;

        if (_opts.extract) {
          str = _opts.extract(element);

          if (!str) {
            // take care of undefineds / nulls / etc.
            str = '';
          }
        }

        const rendered = this.match(pattern, str, _opts);

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

      .sort((a, b) => {
        const compare = b.score - a.score;
        if (compare) return compare;
        return a.index - b.index;
      });
  }
}

export default TributeSearch;
