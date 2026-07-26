## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2026-07-26 - TypeORM Indexing on Class-Level Properties
**Learning:** In TypeORM, when adding class-level `@Index(['propertyName'])` decorators, the referenced `propertyName` must be an explicitly defined primitive property on the class (e.g., `sellerId: string`), not just the relationship property (e.g., `seller: User`) without a defined column. Otherwise, TypeORM throws a "Property not found" error on startup.
**Action:** When adding indexes to foreign keys in TypeORM entities, ensure the underlying column property (e.g., `sellerId`) is explicitly declared on the class alongside the `@ManyToOne` relationship before referencing it in `@Index()`.
