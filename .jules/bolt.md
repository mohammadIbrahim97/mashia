## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2026-08-08 - TypeORM Foreign Key Indexing
**Learning:** TypeORM entities in this codebase (e.g., `Listing`, `Order`) lack database indexes for foreign keys and frequently queried fields. When adding `@Index(['propertyName'])`, `propertyName` must be explicitly defined as a primitive column, not just a relationship property.
**Action:** Always verify if a primitive ID column exists before applying `@Index` decorators in TypeORM entities to prevent "Property not found" errors and avoid full table scans.
