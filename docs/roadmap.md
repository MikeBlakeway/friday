# Roadmap

Friday is currently focused on a coherent local-model workflow MVP. The
implemented path prepares inspectable local context and can execute plan and
review workflows through a configured LM Studio provider. Hosted-provider
execution, API keys, published telemetry, cockpit UI, and autonomous coding
remain outside the current product boundary.

## MVP Definition

The MVP is a local workflow engine with deterministic preparation and optional,
explicit local-model execution:

```bash
friday init
friday local setup
friday doctor
friday evidence --collect
friday run plan "<goal>"
friday run review --changed
friday route ...
friday cost --provider deepseek --model deepseek-v4-flash --input-tokens 12000 --output-tokens 3000
friday usage --since 7d
```

Preparation commands gather local project context, write deterministic evidence,
apply privacy and secret-safety policy, recommend a model route, estimate
advisory cost, and leave inspectable artefacts without calling a provider.
Execution requires a configured localhost provider and explicit approval, then
writes a result artefact and metadata-only usage record.

## Current Implemented Foundation

- Node.js and strongly typed TypeScript CLI foundation
- Optional `~/.friday/` global-memory loading
- `.friday/` project-memory templates and status inspection
- Project-memory loading
- Local evidence file preparation and evidence-pack generation
- Planning prompt workflow
- Review prompt workflow for changed files
- Deterministic privacy classification
- Common secret detection with redacted previews
- Pure model-routing policy and route preview command
- Advisory cost-estimation domain model
- Advisory cost-estimation CLI command
- Provider-neutral model interfaces and mock provider
- Guided LM Studio discovery, model selection, and global provider configuration
- Local-provider diagnostics and opt-in test generation
- One-command local plan and changed-file review execution
- Local result artefacts and metadata-only usage history
- Read-only local usage summaries with time filtering and workflow/model grouping
- Reasoning-aware workflow output allowances and one bounded context-safe retry
- Live TTY-aware workflow progress and redacted assistant-response display
- Vitest, TypeScript, Prettier, Fallow, and build checks

## MVP Release State

- Documentation and project memory are reconciled with the implemented local
  provider experience.
- `friday evidence --collect` can gather deterministic local evidence from Git,
  TypeScript, tests, and Fallow.
- `friday cost` provides advisory estimates from built-in provider/model pricing
  and estimated token counts.
- `friday plan` and `friday review` generate provider-neutral prompts and print
  local privacy, route, and advisory cost summaries for manual inspection before
  any model handoff.
- `friday local setup`, `friday doctor`, and `friday run` provide the guided path
  from model selection to an approved local result.
- Local execution writes metadata-only usage records for successful and failed
  attempts. `friday usage` reports recorded token totals and advisory cost without
  exposing prompt or response content. Cross-project reporting and budget
  enforcement remain planned.

## Post-MVP Work

- Cross-project aggregate usage reporting, richer cost reports, and budget enforcement
- Hosted provider implementations
- Explicit premium escalation and approval flow
- Brainstorm, spec, design, refactor, and ship workflows
- Interactive terminal or desktop/web cockpit
- Autonomous coding

## Deferred

- Voice-first interaction
- Full IDE replacement
- Sending whole repositories to hosted providers by default
