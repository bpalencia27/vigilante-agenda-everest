## 2024-05-24 - Typed Arrays for Levenshtein Distance
**Learning:** Using `Uint16Array` combined with array reference swapping significantly improves performance of algorithms like Levenshtein distance by avoiding the overhead of creating and copying dynamic JavaScript arrays. `Uint16Array` avoids size limits for token lengths up to 65535, whereas `Uint8Array` was previously causing an overflow bug because it overflows at 255 which text strings can easily exceed. Re-using buffers across loop iterations avoids Garbage Collector pressure and memory allocations.
**Action:** Use sufficiently large typed arrays (`Uint16Array`) and reference swapping for dynamic programming matrix rows in frequent operations like fuzzy search. Remember to hoist allocations out of loops.

## 2025-02-12 - Reusing memory in rendering filters
**Learning:** Functions executed in rendering loops like `fuzzyMatch` were generating new `Uint8Array` / array allocations on every call, placing high GC pressure per agenda item.
**Action:** Lift array allocations up to the module scope and share them via references. When required size exceeds current size, dynamically re-allocate memory that is subsequently reused.
