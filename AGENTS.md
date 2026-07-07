# Agent Instructions

## Shorthand Commands

### `/ship`

When the user asks to `/ship`, publish the current completed changes:

1. Inspect `git status -sb` and the diff. Stage only changes that belong to the current task.
2. Run the repo's relevant verification command before committing. Use `npm run check` when available.
3. Commit with a Conventional Commit message using the related Friday issue as the optional scope, for example `(FRI-003)` for issue `#3`. If no issue can be inferred, ask for the scope before committing.
4. Push the current branch to `origin`.
5. Open a pull request with a clear description covering what changed, why, user/developer impact, and validation.
6. Reference and close related GitHub issues when the current task or branch identifies them.

Default PR target: the repository's default branch.
