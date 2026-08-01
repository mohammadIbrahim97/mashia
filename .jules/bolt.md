## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.

## 2024-05-18 - TypeORM Index Properties
**Learning:** When adding class-level `@Index()` decorators in TypeORM for foreign keys or fields, the referenced property name must be an explicitly defined primitive property on the class (e.g., `sellerId: string`), not just the relationship property (e.g., `seller: User`) without a defined column. Otherwise, TypeORM throws a 'Property not found' error.
**Action:** Always verify the explicit primitive property name exists alongside the relationship decorator before adding an index.
