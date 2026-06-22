1. **Remove Duplicate `aria-label` in `Header.tsx`:** Fix the ESLint error by removing the redundant `aria-label="Search"` on the global search input.
2. **Implement `Cmd+K` Shortcut:** Add an effect in `Header.tsx` that listens for `Cmd+K` (or `Ctrl+K`) and focuses the global search input.
3. **Verify:** Run lint and build to ensure it passes.
