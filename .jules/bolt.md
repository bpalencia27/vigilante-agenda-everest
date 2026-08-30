## 2024-05-18 - Hoisting matrix row buffers in fuzzyMatch
**Learning:** In tight inner loops like `fuzzyMatch` (called repeatedly by `matchesSearch` during React-style render filters), allocating small arrays (`[]`) causes significant memory churn and Garbage Collector pressure, even if the arrays are small.
**Action:** Instead of element-wise copying between newly allocated rows, hoist `Uint16Array` buffers to the module level and swap them by reference to eliminate all inner-loop allocations.
