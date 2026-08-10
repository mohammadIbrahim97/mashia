## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.
## 2026-08-10 - Adding TypeORM Indexes
**Learning:** Adding `@Index()` decorators to TypeORM entities is not sufficient when `synchronize: false` is configured (which is typical for production). The changes will not be reflected in the database without a corresponding migration script.
**Action:** When adding indexes or making schema changes in TypeORM with `synchronize: false`, ensure a migration script is generated or manually written in the `migrations` directory to safely deploy the changes.
