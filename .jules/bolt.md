## 2026-06-17 - React Native FlatList Memoization
**Learning:** React Native lists (`FlatList`) in this codebase were causing unnecessary re-renders because `renderItem` functions were created inline or unmemoized in the parent components.
**Action:** When implementing new lists or optimizing existing ones, ensure `renderItem` (or similar list item render functions) are wrapped in `useCallback` with correct dependency arrays to prevent full list re-renders.
## 2026-07-27 - Backend Database Indices Optimization
**Learning:** Found sequential scans on frequently queried `Order` and `Listing` properties (e.g., `sellerId`, `status`) in TypeORM repositories. Added explicit `@Index` decorators to solve this.
**Action:** When adding indices, never install new dependencies (like `@types/express`) to fix pre-existing unrelated test failures unless explicitly requested, as this pollutes `package.json` and creates massive unintended `pnpm-lock.yaml` changes. Revert unintended package manager modifications before submitting.
