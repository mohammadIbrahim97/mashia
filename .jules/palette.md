## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
