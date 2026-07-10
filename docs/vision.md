# Friday Vision

Friday is a local-first AI development cockpit for developers who want more
control over project memory, privacy, model choice, and AI usage cost.

The product starts as a CLI because the first version needs to prove a reliable
workflow engine before adding a richer interface. Friday should make common
AI-assisted development steps repeatable, inspectable, and cost-aware without
turning into a general chatbot or autonomous coding system.

## Current Product Shape

Friday currently works as a local command-line tool. It can:

- initialise `.friday/` project memory
- inspect expected project-memory files
- prepare local evidence-provider files and an evidence pack
- build a planning prompt from project memory and manual evidence, with a local
  privacy, route, and advisory cost summary
- build a review prompt from local changed-file context, project memory, and
  manual evidence, with a local privacy, route, and advisory cost summary
- preview a model route from explicit task and policy inputs
- classify prompt privacy and detect common secrets in pure TypeScript
- estimate advisory model cost through the `friday cost` command
- configure and diagnose a reusable LM Studio local provider and model
- execute planning and changed-file review workflows through that local provider
- preserve prompt and result artefacts plus metadata-only usage history

Friday does not call hosted AI providers, load API keys, stream model output,
publish telemetry, or enforce budgets.

## MVP Direction

Friday v0.1.0 combines deterministic local preparation with explicit local-model
execution:

```bash
friday local setup
friday doctor
friday init
friday evidence --collect
friday run plan "<goal>"
friday run review --changed
friday route ...
friday cost --provider deepseek --model deepseek-v4-flash --input-tokens 12000 --output-tokens 3000
```

The MVP makes local project memory, deterministic evidence, route previews, and
advisory cost estimates inspectable before model execution. Preparation commands
remain provider-neutral. `friday run` adds a safety preflight, approval boundary,
configured localhost model call, result artefact, and local usage record. Friday
does not require API keys, hosted-provider configuration, global developer
memory, a cockpit UI, or autonomous coding.

The example project and architecture diagram support public demo and
presentation work around the local workflow.

## Product Principles

- Keep project context local and inspectable by default.
- Gather deterministic evidence before asking an LLM to reason.
- Recommend the cheapest safe model tier for the task.
- Block secrets before hosted provider execution is possible.
- Preserve developer judgement and explicit control.
- Describe local execution and advisory cost honestly without implying hosted
  execution, billing, or published telemetry.

## Post-MVP Direction

After the local workflow is coherent, Friday can add hosted-provider
integrations, richer workflow commands, budget policy, aggregate usage reports,
and eventually a compact cockpit UI.
