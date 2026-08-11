## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.
## 2026-08-11 - Database index on Order foreign keys
**Learning:** TypeORM entities in this codebase (e.g., `Order`) lacked database indexes for frequently queried foreign keys (`buyerId`, `sellerId`, `brokerId`), leading to sequential table scans in operations like `findMyOrders`.
**Action:** Always verify if entities with heavily filtered foreign keys have corresponding `@Index` decorators and migration files in `backend/db/migrations/` to ensure production performance.
