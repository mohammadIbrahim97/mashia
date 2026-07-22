## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.
## 2024-07-22 - Memoize array reversal in React components
**Learning:** In React components with controlled inputs (like a chat screen), expensive operations on state arrays (like `[...messages].reverse()`) directly in the render body will execute on every keystroke, degrading typing performance and causing unnecessary garbage collection.
**Action:** Wrap computationally expensive derivations of state arrays (like sorting, filtering, or reversing) in `useMemo` with the correct dependency array so the operation only occurs when the source data actually changes, not on unrelated state updates.
