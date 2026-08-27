const assert = require('assert');

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const _fzPrevRow = new Uint16Array(1024);
const _fzCurrRow = new Uint16Array(1024);
const _fzPrevPrevRow = new Uint16Array(1024);
let _fzLastQ = null;
let _fzLastQTokens = null;

function fuzzyMatch(q, text) {
  let queryTokens;
  if (q === _fzLastQ) {
    queryTokens = _fzLastQTokens;
  } else {
    queryTokens = stripAccents(q).toLowerCase().split(/\s+/).filter(Boolean);
    _fzLastQ = q;
    _fzLastQTokens = queryTokens;
  }

  const textTokens = stripAccents(text).toLowerCase().split(/\s+/).filter(Boolean);

  for (const qToken of queryTokens) {
    let tokenMatched = false;
    const m = qToken.length;
    if (m > 1023) continue;
    const maxErrors = m <= 3 ? 0 : (m <= 6 ? 1 : 2);

    for (const tToken of textTokens) {
      if (tToken.includes(qToken)) {
        tokenMatched = true;
        break;
      }
      if (maxErrors === 0) continue;

      const n = tToken.length;
      if (n > 1023) continue;

      // initialize 1st row
      for (let j = 0; j <= n; j++) {
        _fzPrevRow[j] = j;
      }

      for (let i = 1; i <= m; i++) {
        _fzCurrRow[0] = i;
        for (let j = 1; j <= n; j++) {
          const cost = qToken[i - 1] === tToken[j - 1] ? 0 : 1;
          _fzCurrRow[j] = Math.min(
            _fzPrevRow[j] + 1,
            _fzCurrRow[j - 1] + 1,
            _fzPrevRow[j - 1] + cost
          );
          if (i > 1 && j > 1 && qToken[i - 1] === tToken[j - 2] && qToken[i - 2] === tToken[j - 1]) {
            _fzCurrRow[j] = Math.min(_fzCurrRow[j], _fzPrevPrevRow[j - 2] + cost);
          }
        }
        // Swap rows: prevPrevRow <- prevRow, prevRow <- currRow
        for (let j = 0; j <= n; j++) {
          _fzPrevPrevRow[j] = _fzPrevRow[j];
          _fzPrevRow[j] = _fzCurrRow[j];
        }
      }

      let minCost = Infinity;
      for (let j = Math.max(0, m - maxErrors); j <= Math.min(n, m + maxErrors); j++) {
        if (_fzPrevRow[j] < minCost) minCost = _fzPrevRow[j];
      }
      if (minCost <= maxErrors) {
        tokenMatched = true;
        break;
      }
    }
    if (!tokenMatched) return false;
  }
  return true;
}

assert.strictEqual(fuzzyMatch("uribe", "MARIA LUZ DARY URIBE TORRES"), true);
assert.strictEqual(fuzzyMatch("uribbe", "MARIA LUZ DARY URIBE TORRES"), true);
assert.strictEqual(fuzzyMatch("xyz", "MARIA LUZ DARY URIBE TORRES"), false);
assert.strictEqual(fuzzyMatch("muñoz", "MARIA EDINETH PINO MUNOZ"), true);
assert.strictEqual(fuzzyMatch("uribe inexistente", "MARIA LUZ DARY URIBE TORRES"), false);
console.log("Tests passed");
