## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2026-07-31 - Foreign Key Indexing in TypeORM
**Learning:** TypeORM doesn't automatically add indexes to `ManyToOne` foreign keys, resulting in performance bottlenecks (sequential scans) for frequently accessed relationship properties. When applying `@Index()` manually, it must be added to the explicitly defined primitive property column (e.g. `listingId`), rather than just the relationship property (e.g. `listing`).
**Action:** Always verify frequently-queried foreign keys and ensure they have explicit `@Index()` decorators on the primitive foreign key ID column.
