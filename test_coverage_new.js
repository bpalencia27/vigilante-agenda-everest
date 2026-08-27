const assert = require('assert');

function stripAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const _fzPool1 = new Uint16Array(256);
const _fzPool2 = new Uint16Array(256);
const _fzPool3 = new Uint16Array(256);
let _fzLastQ = null;
let _fzLastQTokens = null;

function fuzzyMatchNew(q, text) {
  let queryTokens;
  if (q === _fzLastQ) {
    queryTokens = _fzLastQTokens;
  } else {
    queryTokens = stripAccents(q).toLowerCase().split(/\s+/).filter(Boolean);
    _fzLastQ = q;
    _fzLastQTokens = queryTokens;
  }

  const textTokens = stripAccents(text).toLowerCase().split(/\s+/).filter(Boolean);

  let prevRow = _fzPool1;
  let currRow = _fzPool2;
  let prevPrevRow = _fzPool3;

  for (let t = 0; t < queryTokens.length; t++) {
    const qToken = queryTokens[t];
    let tokenMatched = false;
    const m = qToken.length;
    if (m > 255) continue;
    const maxErrors = m <= 3 ? 0 : (m <= 6 ? 1 : 2);

    for (let u = 0; u < textTokens.length; u++) {
      const tToken = textTokens[u];
      if (tToken.includes(qToken)) {
        tokenMatched = true;
        break;
      }
      if (maxErrors === 0) continue;

      const n = tToken.length;
      if (n > 255) continue;

      for (let j = 0; j <= n; j++) {
        prevRow[j] = j;
      }

      for (let i = 1; i <= m; i++) {
        currRow[0] = i;
        const qChar = qToken[i - 1];
        const qCharPrev = i > 1 ? qToken[i - 2] : null;

        for (let j = 1; j <= n; j++) {
          const tChar = tToken[j - 1];
          const cost = qChar === tChar ? 0 : 1;
          const a = prevRow[j] + 1;
          const b = currRow[j - 1] + 1;
          const c = prevRow[j - 1] + cost;
          currRow[j] = a < b ? (a < c ? a : c) : (b < c ? b : c);

          if (i > 1 && j > 1 && qChar === tToken[j - 2] && qCharPrev === tChar) {
            const d = prevPrevRow[j - 2] + cost;
            if (d < currRow[j]) currRow[j] = d;
          }
        }
        const temp = prevPrevRow;
        prevPrevRow = prevRow;
        prevRow = currRow;
        currRow = temp;
      }

      let minCost = 9999;
      for (let j = Math.max(0, m - maxErrors); j <= Math.min(n, m + maxErrors); j++) {
        if (prevRow[j] < minCost) minCost = prevRow[j];
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

assert.strictEqual(fuzzyMatchNew("uribe", "MARIA LUZ DARY URIBE TORRES"), true);
assert.strictEqual(fuzzyMatchNew("uribbe", "MARIA LUZ DARY URIBE TORRES"), true);
assert.strictEqual(fuzzyMatchNew("xyz", "MARIA LUZ DARY URIBE TORRES"), false);
assert.strictEqual(fuzzyMatchNew("muñoz", "MARIA EDINETH PINO MUNOZ"), true);
assert.strictEqual(fuzzyMatchNew("uribe inexistente", "MARIA LUZ DARY URIBE TORRES"), false);

// Transposition test
assert.strictEqual(fuzzyMatchNew("palencai", "BRANDON JESUS PALENCIA MARTINEZ"), true);
console.log("All coverage tests passed!");
