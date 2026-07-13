# Contributing to Friday

## Project Status

Friday is currently an early-stage personal and portfolio project, but it is maintained with a lightweight professional workflow.

## Workflow

Normal contribution flow:

1. Pick or create a GitHub issue.
2. Create a branch using the Friday branch naming convention.
3. Keep the change focused.
4. Run verification locally.
5. Open a pull request for meaningful changes.
6. Merge only when checks pass.

Capability-changing pull requests should update the relevant public documentation
and dogfooded `.friday/` project memory in the same change. Keep implemented and
planned behavior explicit, preserve superseded decisions as history, and do not
commit live execution output or machine-specific runtime history.

Tiny documentation or wording updates may be made directly when appropriate, but feature work should use branches.

## Branch Naming

Use the following format:

```txt
<type>/FRI-<issue-number-as-3-digits>
```

Supported examples:

```txt
feat/FRI-001
fix/FRI-012
docs/FRI-009
chore/FRI-010
refactor/FRI-015
test/FRI-016
```

- `type` should describe the kind of change.
- `FRI` identifies the Friday project.
- The number maps to the related GitHub issue ID.
- Pad the issue number to three digits.

Example:

```bash
git checkout -b feat/FRI-001
```

## Commit Guidance

Keep commits clear and focused. Conventional-style prefixes are welcome but not required.

Examples:

```txt
Add privacy classification foundation
Document Friday workflow
Refactor routing test fixtures
```

## Pull Requests

Pull requests should include:

- A short summary
- Linked issue where relevant
- Verification performed
- Notes on trade-offs or follow-up work

## Verification

Before opening or merging a meaningful change, run:

```bash
npm run check
```

This currently covers formatting, type checking, tests, Fallow/static checks if configured, and build.

## Scope Discipline

Friday should avoid overbuilding.

- Keep changes small.
- Avoid provider integrations before safety and cost gates are ready.
- Avoid adding dependencies without a clear need.
- Keep current and planned features clearly separated.
- Do not claim planned features are already implemented.
