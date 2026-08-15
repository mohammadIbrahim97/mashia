## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2024-05-20 - React Native FlatList Data Mutation
**Learning:** In React Native, dynamically creating or mutating arrays (e.g., `[...data].reverse()`) directly inside a component's render body and passing it to a `FlatList` causes severe input lag and unnecessary list re-renders because the array reference changes on every render.
**Action:** Always wrap array transformations passed to list components in `React.useMemo` to provide a stable reference and prevent performance degradation.
