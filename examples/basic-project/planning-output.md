# Friday Planning Prompt

## Goal

Add recipe sharing

## Instructions

You are helping plan the next step for this software project.

Use the project memory and evidence below.

Prioritise:

- practical implementation steps
- strongly typed TypeScript
- privacy-aware design
- cost-conscious AI usage
- simple architecture
- clear trade-offs
- small incremental delivery

Do not invent existing code or project decisions.
If context is missing, say what is missing.

## Project Memory

### project.md

# Recipe Notes

Recipe Notes is a small web app for saving family recipes, tagging them by meal
type, and planning a weekly cook list.

The project is intentionally simple. It uses local data first, keeps the main
workflow focused on creating and editing recipes, and avoids social features
until the core recipe flow feels reliable.

### architecture.md

# Architecture

The app is a single-page TypeScript application with three planned layers:

- `src/domain` for recipe, ingredient, and meal-plan types
- `src/storage` for local persistence behind a small repository interface
- `src/ui` for screens, forms, and navigation

The first version should run without a backend. Storage can begin with a local
JSON file or browser storage, then move behind the repository interface later if
sync becomes important.

### decisions.md

# Decisions

## Start With Local Storage

Local storage keeps the example easy to run and avoids account setup. The app
can add sync later if the recipe model proves useful.

## Keep Sharing Out Of Scope

Sharing recipes is tempting, but it adds permissions, moderation, and product
complexity. The portfolio example should show a focused workflow instead.

### design.md

# Design

The app should feel practical and calm rather than playful. The main screen
shows a searchable recipe list on the left and the selected recipe on the right.

Useful interface details:

- compact tags for breakfast, lunch, dinner, snack, and dessert
- a clear edit button near the recipe title
- ingredient checkboxes for cooking mode
- a small weekly plan view that reuses saved recipes

### tasks.md

# Tasks

## Next

- define the `Recipe`, `Ingredient`, and `MealPlanEntry` types
- create a sample data file with three recipes
- build the recipe list and detail view
- add a simple create and edit form
- write tests for recipe filtering and meal-plan assignment

### notes.md

# Notes

This directory is a small Friday memory example. It demonstrates how a project
can keep reusable planning context in plain Markdown files under `.friday/`.

Run a planning command from the example project root:

```bash
friday plan "Add recipe sharing"
```

Friday loads the memory files, ignores empty files, and builds an inspectable
planning prompt that can be reviewed before any AI handoff.

## Evidence

No additional evidence was provided.

## Required Output

Return:

1. Recommended approach
2. Implementation steps
3. Files likely to change
4. Risks and trade-offs
5. Questions to resolve
6. Suggested first commit
