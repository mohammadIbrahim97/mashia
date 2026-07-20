## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2026-07-20 - React Native FlatList Data Memoization
**Learning:** React Native lists (`FlatList`) in this codebase can cause significant performance degradation when data arrays are modified (e.g., copied and reversed) directly in the component's render body, particularly during frequent state updates like typing in an input field.
**Action:** When passing derived data arrays to a `FlatList` (e.g., `[...data].reverse()`), ensure the array is wrapped in `useMemo` with correct dependency arrays. This maintains referential equality and prevents expensive O(N) operations and unnecessary list item re-renders.
