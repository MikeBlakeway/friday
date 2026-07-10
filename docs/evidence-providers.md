# Evidence Providers

Friday gathers deterministic local evidence before asking an AI model to reason about
a project. Evidence providers are not AI providers: they are local sources of facts
that a developer can inspect, edit, and rerun.

Run:

```bash
friday evidence
friday evidence --collect
friday evidence --collect --timeout-ms 30000
```

The command creates `.friday/evidence/` and writes an inspectable
`.friday/evidence/evidence-pack.json`. It does not call an AI provider and does not
run provider commands unless `--collect` is explicitly supplied.

## Provider Files

`friday evidence` creates these local files if they are missing:

- `manual.md` - structured developer notes discovered by inspection
- `fallow-summary.md` - Fallow static-code intelligence
- `git-summary.md` - branch, diff, and history facts from local Git commands
- `typescript-summary.md` - TypeScript compiler findings
- `test-summary.md` - test runner findings

Without `--collect`, all existing files are preserved. With `--collect`, Friday
replaces only untouched placeholder provider files. User-authored provider summaries
and `manual.md` are preserved, so collection never silently overwrites edited evidence.
Placeholder provider files are ignored by the evidence pack until a developer replaces
them manually or runs collection.

## Manual Evidence

Manual evidence uses one markdown section per item:

```md
## Medium - Duplicate provider setup

The provider construction pattern appears in multiple modules.
```

Supported severities are `info`, `low`, `medium`, and `high`. Unknown severities are
treated as `info`.

## Provider Evidence

Provider summary files are intentionally simple markdown files. Run deterministic
providers explicitly with:

```bash
friday evidence --collect
```

Before collection starts, Friday prints the exact local commands it will execute and
the per-command timeout. Collection executes these commands in the project root:

```bash
git status -sb
git diff --stat
npm run typecheck
npm test
npm run fallow
```

Each provider file records the command, pass/fail/timeout status, exit code, timeout,
standard output, and standard error. The default timeout is 120000 ms per command; use
`--timeout-ms <milliseconds>` to choose a different positive integer. A failing or
timed-out command is captured in its provider file and does not stop the remaining
providers or evidence-pack generation. Captured command streams are normalized to Unix
line endings and truncated at a documented marker if unusually long.

## Trust Boundary

`friday evidence --collect` is intended for repositories you trust enough to run their
local package scripts. Git commands are fixed, but `npm run typecheck`, `npm test`, and
`npm run fallow` execute scripts and dependencies from the target repository. Friday
does not sandbox or containerize those commands. The timeout limits hung or unexpectedly
long-running commands and records the result as evidence, but it is not a security
boundary for untrusted code.

To recollect a provider after editing or inspecting it, remove that provider summary
file first. Friday will recreate and collect it on the next `--collect` run. This
explicit removal step protects authored evidence from accidental replacement.

Fallow should be treated as static codebase intelligence, not as an LLM. Fallow tells
Friday what is structurally true about the codebase; a later AI workflow can help
decide what to do about it.

## Workflow Usage

Evidence is stored under `.friday/evidence/` so future workflows can reuse it:

- `friday plan`
- `friday review`
- `friday refactor`
- `friday health`
