# Evidence Providers

Friday gathers deterministic local evidence before asking an AI model to reason about
a project. Evidence providers are not AI providers: they are local sources of facts
that a developer can inspect, edit, and rerun.

Run:

```bash
friday evidence
```

The command creates `.friday/evidence/` and writes an inspectable
`.friday/evidence/evidence-pack.json`. It does not call an AI provider and does not
force any provider command to run.

## Provider Files

`friday evidence` creates these local files if they are missing:

- `manual.md` - structured developer notes discovered by inspection
- `fallow-summary.md` - Fallow static-code intelligence, added manually for now
- `git-summary.md` - branch, diff, and history facts from local Git commands
- `typescript-summary.md` - TypeScript compiler findings
- `test-summary.md` - test runner findings

Existing files are preserved. Placeholder provider files are ignored by the evidence
pack until a developer replaces them with real evidence.

## Manual Evidence

Manual evidence uses one markdown section per item:

```md
## Medium - Duplicate provider setup

The provider construction pattern appears in multiple modules.
```

Supported severities are `info`, `low`, `medium`, and `high`. Unknown severities are
treated as `info`.

## Provider Evidence

Provider summary files are intentionally simple markdown files. For this milestone,
Friday prepares the storage and aggregation architecture without running providers
automatically.

Suggested local commands:

```bash
git status -sb
git diff --stat
npm run typecheck
npm test
npm run fallow
```

Fallow should be treated as static codebase intelligence, not as an LLM. Fallow tells
Friday what is structurally true about the codebase; a later AI workflow can help
decide what to do about it.

## Workflow Usage

Evidence is stored under `.friday/evidence/` so future workflows can reuse it:

- `friday plan`
- `friday review`
- `friday refactor`
- `friday health`
