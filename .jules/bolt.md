## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2026-06-17 - React Native FlatList Memoization Stability
**Learning:** When extracting `FlatList` render items into `React.memo` wrapped components, ensuring stable callbacks is critical. If parent components pass inline arrow functions (e.g., `onPress={() => navigate(...)}`) to the memoized children, the shallow comparison of `React.memo` will always fail because a new function reference is created on every parent render. This defeats the optimization entirely.
**Action:** When optimizing `FlatList` items with `React.memo`, always stabilize callbacks passed to them using `useCallback` in the parent component to maintain referential equality.
