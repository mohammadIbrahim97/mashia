## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2023-10-27 - React Native FlatList Data Memoization
**Learning:** In React Native, derived data arrays passed to a `FlatList` (e.g., `[...data].reverse()`) cause unnecessary re-renders during frequent component updates (like typing) if not memoized.
**Action:** Wrap derived data arrays passed to `FlatList` in `useMemo` to maintain referential equality and prevent expensive O(N) operations and unnecessary re-renders.
