## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.
## 2026-08-05 - TypeORM Foreign Key Indexing
**Learning:** TypeORM does not automatically index foreign keys for `@ManyToOne` relations unless `@Index()` is explicitly added. Without these, queries filtering by foreign keys (e.g., fetching a user's orders) will perform sequential table scans, degrading performance as tables grow. When adding `@Index(['propertyName'])`, ensure the `propertyName` references an explicitly defined scalar column (e.g., `@Column() sellerId: string`) rather than just the relation property (e.g., `seller: User`).
**Action:** Always add `@Index()` decorators for foreign keys and frequently queried fields on TypeORM entities to prevent N+1 query problems and sequential scans.
