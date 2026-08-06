## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.
## 2026-06-18 - TypeORM Foreign Key Indexing
**Learning:** In TypeORM entities in this codebase (e.g., Listing, Order, Certificate, Payment), database indexes for foreign keys (e.g., sellerId, buyerId) and frequently queried fields (e.g., createdAt) were missing, leading to potential sequential scans.
**Action:** Add `@Index()` decorators to explicitly defined primitive properties (e.g., `sellerId: string`) alongside the relationship decorator (e.g., `seller: User`), instead of on the relationship property itself, to optimize query performance and prevent TypeORM 'Property not found' errors.
