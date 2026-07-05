## 2024-06-20 - Accessible Interactive Icons
**Learning:** By default, visual interactive elements like a `Bell` icon and a letter/initial avatar `div` are not accessible via keyboard nor identifiable by screen readers.
**Action:** Use semantic `<button>` elements with `aria-label` and `focus-visible` ring styling from the existing Tailwind scale (`focus-visible:ring-2 focus-visible:ring-mashia-600 focus-visible:outline-none`) instead of relying solely on `cursor-pointer` on unsemantic tags.
## 2024-05-23 - Interactive Element Focus States
**Learning:** Many older interactive elements (like the global search and sidebar actions) lack distinct `focus-visible` or `focus-within` states and use generic `div` or non-semantic `button` elements without `aria-label` tags.
**Action:** Always wrap visual icons that act as actions in semantic `<button>` tags with `aria-label`, and use the existing Tailwind palette (e.g., `focus-visible:ring-mashia-600` or `focus-visible:ring-gold`) to provide explicit keyboard navigation feedback.
## 2024-05-27 - Overline Typographic Labels
**Learning:** In the Mashia admin design system, `Overline` typography components act as visual labels for inputs (e.g. login form, confirm dialog). If they lack `htmlFor`, they remain generic `div`s, causing the adjacent inputs to be completely inaccessible to screen readers.
**Action:** Always check typography components placed above inputs. Update them to support and use `htmlFor` so they conditionally render as semantic `<label>` elements, linking them structurally to the `id` of the form controls.
