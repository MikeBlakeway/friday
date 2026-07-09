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
- build a planning prompt from project memory and manual evidence
- build a review prompt from local changed-file context, project memory, and
  manual evidence
- preview a model route from explicit task and policy inputs
- classify prompt privacy and detect common secrets in pure TypeScript
- estimate advisory model cost in the domain layer
- define provider-neutral model interfaces and a deterministic mock provider

Friday does not currently call real AI providers, load API keys, stream model
output, log real usage, enforce budgets, or expose a `friday cost` command.

## MVP Direction

The MVP should be a no-provider local workflow engine:

```bash
friday init
friday evidence
friday plan "<goal>"
friday review --changed
friday route ...
```

The MVP should make it clear what local context was loaded, what evidence was
used, what privacy level applies, which route would be recommended, and what the
estimated cost would be before any future model call.

## Product Principles

- Keep project context local and inspectable by default.
- Gather deterministic evidence before asking an LLM to reason.
- Recommend the cheapest safe model tier for the task.
- Block secrets before hosted provider execution is possible.
- Preserve developer judgement and explicit control.
- Avoid claiming provider execution or cost tracking until those paths exist.

## Post-MVP Direction

After the local workflow is coherent, Friday can add automatic evidence
collection, `friday cost`, usage logging, local model execution, hosted provider
integrations, richer workflow commands, and eventually a compact cockpit UI.
