## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2024-07-24 - React Native FlatList Data Memoization
**Learning:** Reversing or copying arrays directly in the render body (e.g., `[...messages].reverse()`) before passing them to `FlatList` causes the data reference to change on every render. This breaks `FlatList`'s internal memoization and causes input lag during frequent state updates (like typing).
**Action:** Always wrap array transformations passed to `FlatList.data` in `useMemo` with appropriate dependencies to maintain stable references.
