## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2026-07-25 - Database Indexes on TypeORM Entities
**Learning:** TypeORM entities in this codebase (like `Listing`) were missing database indexes for frequently used query patterns, such as fetching active records sorted by date (e.g. `status` + `createdAt`). This causes unoptimized sequential scans on large tables.
**Action:** Always verify and add `@Index()` decorators in TypeORM entities for fields frequently used in `.where()` and `.orderBy()` clauses to maintain database performance at scale.
