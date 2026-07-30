## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2026-07-30 - TypeORM Entity Indexes
**Learning:** TypeORM entities in this codebase (e.g., `Listing`, `Order`) may lack database indexes for foreign keys and frequently queried fields. This causes unnecessary full table scans during data retrieval.
**Action:** Add `@Index()` decorators (including composite indexes like `@Index(['field1', 'field2'])`) to optimize query performance and avoid sequential scans when querying by fields such as `sellerId`, `buyerId`, or `status`. Always ensure the column is explicitly defined on the class when using class-level decorators.
