## 2024-05-24 - Typed Arrays for Levenshtein Distance
**Learning:** Using `Uint16Array` combined with array reference swapping significantly improves performance of algorithms like Levenshtein distance by avoiding the overhead of creating and copying dynamic JavaScript arrays. `Uint16Array` avoids size limits for token lengths up to 65535, whereas `Uint8Array` was previously causing an overflow bug because it overflows at 255 which text strings can easily exceed. Re-using buffers across loop iterations avoids Garbage Collector pressure and memory allocations.
**Action:** Use sufficiently large typed arrays (`Uint16Array`) and reference swapping for dynamic programming matrix rows in frequent operations like fuzzy search. Remember to hoist allocations out of loops.

## 2024-05-25 - Query Tokenization Caching
**Learning:** Functions executed within a render filtering loop (like `fuzzyMatch`) can cause significant performance bottlenecks if they redundantly tokenize static query inputs on every call. In this codebase, the `fuzzyMatch` function parsed the search query and allocated regex tokens on every agenda item.
**Action:** Always hoist query-based text operations out of repetitive loops. Cache search queries and their parsed tokens to reuse across function calls when the query hasn't changed.
