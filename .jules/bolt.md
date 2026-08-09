## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.
## 2026-08-09 - TypeORM Database Indexes
**Learning:** In TypeORM, foreign keys (e.g. `@ManyToOne` relations) are not automatically indexed by the database. Querying these fields frequently without an index leads to full table scans.
**Action:** Always manually add the `@Index()` decorator to frequently queried foreign key columns (like `sellerId`, `listingId`, `buyerId`) defined alongside `@JoinColumn` to ensure efficient database lookups and JOIN performance.
