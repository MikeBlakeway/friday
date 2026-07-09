# Architecture

The app is a single-page TypeScript application with three planned layers:

- `src/domain` for recipe, ingredient, and meal-plan types
- `src/storage` for local persistence behind a small repository interface
- `src/ui` for screens, forms, and navigation

The first version should run without a backend. Storage can begin with a local
JSON file or browser storage, then move behind the repository interface later if
sync becomes important.

Friday should treat this as a low-risk planning example, not as production
architecture.
