## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.
## 2023-11-20 - React.memo Optimization in FlatList

**Learning:** When using `React.memo` for list items in a `FlatList`, ensure that any callbacks passed down (like `onPress`) are stable, created with `useCallback`. Furthermore, make sure to add comments explaining *why* the optimization was made and the expected impact, as required by the role's instructions.
**Action:** When applying `React.memo` to list items, double-check that all functions passed as props are wrapped in `useCallback`. Always include clear comments detailing the performance optimization to ensure maintainability and fulfill role requirements.
