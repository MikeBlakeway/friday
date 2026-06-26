# Evidence Providers

Friday should gather deterministic evidence before asking an AI model to reason about a project.

Evidence providers are not AI providers.

Fallow should be treated as static codebase intelligence, not as an LLM.

Fallow tells Friday what is structurally true about the codebase. The LLM helps Friday decide what to do about it.

## Evidence Sources

Evidence can come from:

- Fallow
- Git
- TypeScript
- test runners
- manual developer notes

## Why This Matters

The first integration should be lightweight and local.

Fallow should not be mandatory for `friday plan` yet.

Future evidence should be stored under `.friday/evidence/`.

## Planned Workflow Usage

Evidence will later be used by workflows like:

- `friday plan`
- `friday review`
- `friday refactor`
- `friday health`
