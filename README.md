# Friday

**Friday is a local-first AI development cockpit for planning, designing, building and reviewing software with project memory, privacy-aware context handling, model routing and cost control.**

Friday was created to solve a real problem in modern AI-assisted development: powerful AI tools are now spread across chat apps, IDE plugins, coding agents and premium model subscriptions. That fragmentation creates repeated context sharing, inconsistent workflows, unnecessary cost, and unclear privacy boundaries.

Friday brings those workflows into one developer-owned system.

---

## Why Friday Exists

Modern AI-assisted development is powerful, but messy.

A typical workflow can easily involve:

- ChatGPT or Claude for brainstorming
- another AI tool for specifications
- another for design and wireframes
- Copilot or Codex-style tools for code generation
- premium models for complex debugging and review
- repeated manual copying of project context between tools

This creates real problems for developers:

- project context gets lost between tools
- premium models are overused for low-risk work
- AI agents can burn through tokens unnecessarily
- privacy decisions are often unclear
- usage cost is difficult to understand
- developer focus is lost to tool switching

Friday is an attempt to solve that problem with a practical, developer-owned workflow layer.

---

## Core Idea

Friday separates AI-assisted development into three layers:

```txt
Global developer memory
+
Project-specific memory
+
Model routing and workflow commands
```

The aim is simple:

> Keep project context under developer control, route each task to the cheapest suitable model, and only escalate to premium AI when the task genuinely needs it.

For the current local-first shape and planned extension points, see the
[architecture diagram](./docs/architecture.md#architecture-diagram).

---

## Key Principles

Friday is built around a few core principles:

### 1. Local-first where privacy matters

Private project context, sensitive implementation details, secrets, and personal workflow notes should stay local unless there is a clear reason to send them to a hosted model.

### 2. Cheap by default

Premium models should not be the default for every task. Friday should use cheaper or local models for routine work and reserve expensive models for high-value reasoning, final review, or escalation.

### 3. Project memory belongs to the developer

Context should not be trapped inside individual chat sessions or vendor tools. Friday stores reusable memory in local markdown files that can be read, reviewed, versioned, and reused.

### 4. Structured workflows beat messy chats

Brainstorming is important, but production development also needs structure. Friday turns common AI workflows into repeatable commands such as planning, specification, review, refactoring, and cost reporting.

### 5. AI should assist judgement, not replace it

Friday is designed to support experienced developers, not hide engineering decisions behind opaque automation.

---

## MVP Definition

Friday's MVP is a no-provider local workflow engine. It should prove the
developer-owned workflow before adding hosted provider execution, API keys,
network calls, usage telemetry, global memory, cockpit UI, or autonomous coding.

The MVP-critical command path is:

```bash
friday init
friday evidence
friday plan "<goal>"
friday review --changed
friday route ...
friday cost --provider deepseek --model deepseek-v4-flash --input-tokens 12000 --output-tokens 3000
```

This path should gather local project memory and deterministic evidence, apply
privacy and secret-safety policy, recommend a model route, estimate advisory
cost, and write inspectable artifacts. It must not require API keys or call an
AI provider.

Demo work such as the example project and architecture diagram matters after the
local workflow is coherent, so it is positioned as presentation work rather than
MVP engine scope.

---

## Planned Features

Friday is currently in early development. The initial focus is on the core engine, not a polished UI.

### Foundation

- [ ] Global developer memory (post-MVP)
- [x] Per-project memory
- [x] Project initialisation
- [x] Workflow-specific prompt templates
- [x] Strongly typed TypeScript architecture

### Privacy and Safety

- [x] Prompt privacy classification
- [x] Secret detection
- [x] Local-first routing for sensitive context
- [x] Hosted model blocking for unsafe prompts

### Model Routing

- [x] Provider-agnostic model interface
- [ ] Local model support (post-MVP)
- [ ] DeepSeek provider support (post-MVP)
- [ ] OpenAI provider support (post-MVP)
- [ ] Anthropic provider support (post-MVP)
- [x] Task-based model routing
- [x] Premium route recommendation
- [ ] Premium execution approval flow (post-MVP)

### Cost Control

- [x] Advisory cost estimation domain model
- [x] `friday cost` CLI command
- [ ] Token usage logging (post-MVP)
- [ ] Estimated cost tracking from real usage (post-MVP)
- [ ] Cost report by task (post-MVP)
- [ ] Cost report by provider/model (post-MVP)
- [ ] Budget rules (post-MVP)

### Developer Workflows

- [x] `friday init`
- [x] `friday evidence`
- [ ] `friday brainstorm`
- [x] `friday plan`
- [ ] `friday spec`
- [ ] `friday design`
- [x] `friday review`
- [x] `friday route`
- [x] `friday cost`
- [ ] `friday escalate` (post-MVP)

---

## Intended Workflow

The current local workflow uses the implemented local commands:

```bash
friday init
friday evidence
friday plan "Build a lightweight AI code review assistant"
friday review --changed
friday route --task review --privacy private-repo --complexity high --confidence standard --cost balanced
friday cost --provider deepseek --model deepseek-v4-pro --input-tokens 12000 --output-tokens 3000
```

This workflow creates inspectable local artefacts and route recommendations. It
does not call an AI provider. `friday cost` provides an advisory local estimate
from configured provider/model pricing and estimated token counts, while
brainstorming, specification, provider execution, usage telemetry, and explicit
escalation commands remain post-MVP.

The goal is not to replace the developer’s judgement. The goal is to reduce
friction, preserve context, manage cost, and make AI-assisted development easier
to control.

---

## Memory Structure

Friday uses two types of memory.

### Global Friday Memory

Global memory describes how the developer likes to work.

Example:

```txt
~/.friday/
  profile.md
  coding-standards.md
  model-policy.md
  privacy-policy.md
  cost-policy.md
  review-checklist.md

  prompts/
    brainstorm.md
    plan.md
    spec.md
    design.md
    build.md
    review.md
    refactor.md
    ship.md
```

This memory is reusable across projects.

### Project Friday Memory

Each project can have its own local Friday memory.

Example:

```txt
repo/.friday/
  project.md
  architecture.md
  decisions.md
  design.md
  tasks.md
  notes.md

  evidence/
    manual.md
    fallow-summary.md
    git-summary.md
    typescript-summary.md
    test-summary.md
    evidence-pack.json
```

This memory describes the current project, its goals, architecture, design direction, decisions, and active tasks.

### Local Evidence

Use `friday evidence` after `friday init` to create local evidence provider files
under `.friday/evidence/`. Add `--collect` to explicitly run local Git, TypeScript,
test, and Fallow commands and write their normalized output before generating
`.friday/evidence/evidence-pack.json`. Neither mode calls an AI provider.

Manual evidence lives in `.friday/evidence/manual.md` as markdown sections:

```md
## High - Missing integration test

The auth callback path is not covered by the test suite.
```

Provider summary files are reserved for local command output or human-written
summaries from Fallow, Git, TypeScript, and test runners. Collection replaces only
untouched placeholders; `manual.md` and edited provider summaries are preserved.
Provider command failures are recorded as evidence rather than aborting the workflow.

---

## Model Routing Philosophy

Friday is designed around a model ladder.

```txt
Tier 0 — No AI
Use the compiler, tests, linting, search, and documentation first.

Tier 1 — Local model
Use for private context, simple explanations, local notes, and low-risk work.

Tier 2 — Cheap hosted model
Use for brainstorming, summaries, documentation, PR descriptions, and routine drafting.

Tier 3 — Strong hosted low-cost model
Use for technical planning, first-pass review, debugging, and multi-file reasoning.

Tier 4 — Premium model
Use for final architecture review, difficult debugging, security-sensitive reasoning, and high-confidence escalation.
```

### Preview a Route

Use `friday route` to preview the routing decision for a task without calling any AI
provider:

```bash
friday route --task review --privacy private-repo --complexity high --confidence standard --cost balanced
```

The command prints the selected decision, provider, model tier, model, warnings, and
alternatives. Add `--local-only` to disable hosted models or `--allow-premium` to let
the policy recommend premium routes when the task earns escalation.

The guiding rule:

> Start with the cheapest safe option and escalate only when the task earns the cost.

---

## Example Use Cases

Friday is intended to help with:

- brainstorming product ideas
- shaping technical plans
- creating implementation specs
- generating project task lists
- reviewing changed files
- explaining failing tests
- planning refactors
- summarising pull requests
- tracking AI usage cost
- deciding when premium model escalation is justified

For a small portfolio-friendly walkthrough, see the
[basic project example](./examples/basic-project/README.md). It shows a sample
`.friday/` memory folder and the planning prompt output Friday can build from
that local context.

---

## What Friday Is Not

Friday is not intended to be:

- a general chatbot clone
- a full IDE replacement
- a fully autonomous coding agent
- a vendor-specific wrapper
- a hosted provider execution layer in the MVP
- a telemetry or billing system in the MVP
- a tool that sends entire repositories to hosted models by default
- a way to avoid senior engineering judgement

Friday is a workflow layer for developers who want more control over AI-assisted software work.

---

## Current Status

Friday is currently an early CLI-first local workflow engine. It can initialise
and inspect per-project memory, collect deterministic local evidence, build
planning and review prompts from local context, preview model routes, classify
privacy risk, detect common secrets, estimate advisory model costs in the domain
layer, and define provider-agnostic model contracts. It still does not call real
AI providers.

Implemented CLI commands:

- `friday init`
- `friday status`
- `friday evidence`
- `friday plan <goal...>`
- `friday review --changed`
- `friday route`
- `friday cost --provider <provider> --model <model> --input-tokens <n> --output-tokens <n>`

Planned CLI commands include `friday brainstorm`, `friday spec`, `friday design`,
and `friday escalate`.

Friday now includes a pure model-routing domain layer that recommends blocked,
local, cheap hosted, strong hosted, or premium routes from task and policy input.
It makes no provider calls: provider integrations and real AI requests remain
planned work.

Friday also includes a provider-agnostic `friday cost` command backed by the
cost estimation domain layer. It combines configured per-million input and
output token prices with estimated token counts to produce deterministic
advisory estimates. These estimates are not billing records and should be
treated as planning guidance until real usage telemetry and usage logging exist.

Friday now includes a deterministic privacy safety gate for future AI provider
integrations. It classifies prompt or project context as public, internal,
private-repo, sensitive, or secret, detects common secret patterns, and blocks
secret context before any hosted model handoff. This foundation remains local
and provider-agnostic: it does not load credentials, call model SDKs, or make
network requests.

Friday can now compose that privacy classification with model routing for a raw
task prompt. Secret context returns a blocked route with no hosted alternatives,
sensitive context defaults to a local route, and safety warnings are returned as
user-facing text. This is still recommendation-only: provider calls remain
planned work.

Friday also includes provider-neutral interfaces and a deterministic mock
provider for future model execution tests. Real local and hosted provider
implementations, API-key loading, streaming, and tool-call execution are not
implemented.

The current MVP direction is a no-provider local workflow engine that can:

1. initialise project memory
2. load project context
3. collect deterministic local evidence
4. classify request privacy and block secret-bearing context
5. route a task to an appropriate model tier without executing it
6. estimate advisory usage cost
7. create inspectable planning, review, cost, and evidence artefacts

MVP-critical commands are `friday init`, `friday evidence`, `friday plan`,
`friday review`, `friday route`, and `friday cost`. Post-MVP work includes
global developer memory, usage telemetry, budget reporting, provider execution,
autonomous coding, example/demo presentation work, architecture-diagram polish,
and a richer cockpit UI.

---

## Tech Stack

Current stack:

- TypeScript
- Node.js
- CLI-first interface
- Markdown-based memory
- JSON artefacts for evidence packs
- Vitest for testing
- Provider-agnostic AI interfaces

Future possibilities:

- local model integration
- hosted model integrations
- interactive terminal UI
- desktop or web cockpit
- voice-enabled workflows
- richer project memory and retrieval

---

## Roadmap

### Milestone 1 — Foundation

- [x] Project structure
- [x] CLI skeleton
- [ ] Global memory templates
- [x] Project memory templates
- [x] Project memory loading
- [x] Basic tests

### Milestone 2 — Privacy and Cost

- [x] Privacy classification
- [x] Secret detection
- [x] Advisory cost estimation domain model
- [ ] Model pricing configuration files
- [ ] Usage logging
- [ ] Cost reporting CLI

### Milestone 3 — Model Routing

- [x] Provider interfaces
- [x] Routing rules
- [x] Route preview command
- Local provider support
- Hosted provider support
- Escalation execution flow

### Milestone 4 — Core Workflows

- Brainstorm workflow
- [x] Planning prompt workflow
- Specification workflow
- [x] Code review prompt workflow
- Cost reporting workflow
- [x] Local evidence preparation workflow
- [x] Opt-in deterministic evidence collection

### Milestone 5 — Portfolio Polish

- Architecture documentation
- Example project
- Demo screenshots or GIF
- Public roadmap
- Usage examples

---

## Project Motivation

Friday is built from a real developer pain point.

AI tools can be incredibly useful, but experienced developers increasingly need to manage:

- which model to use
- how much context to provide
- what data is safe to share
- whether the output is worth the cost
- how to keep project knowledge consistent
- how to avoid tool sprawl

Friday explores what a more deliberate AI development workflow could look like.

---

## Fallow Workflow

Friday uses Fallow in two ways:

- Fast gating in `npm run check` via `npm run fallow` (`fallow --ci`)
- Saved report artifacts for review and triage

Useful commands:

```bash
npm run fallow                # CI-style pass/fail signal
npm run fallow:dead-code      # Focused dead code analysis
npm run fallow:dupes          # Focused duplication analysis
npm run fallow:health         # Focused complexity/health analysis
npm run fallow:review         # Generate JSON reports + print short summary
```

Generated reports are written to:

```txt
reports/fallow/dead-code.json
reports/fallow/dupes.json
reports/fallow/health.json
```

These report files are ignored by git so they can be regenerated locally without polluting commits.

---

## Deterministic Evidence Providers

Friday gathers deterministic repo evidence before using AI reasoning in planning and review workflows.

Evidence sources include:

- Fallow static analysis
- Git history and change metadata
- TypeScript diagnostics
- test runner output
- manual developer evidence notes

The intended direction is to treat evidence providers as structural project signals, separate from AI model providers.

---

## Contributing

Friday is currently an early-stage personal and portfolio project, but it uses a lightweight professional workflow for issues, branches, pull requests and CI.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch naming convention and contribution workflow.

---

## License

TBC.

---

## Author

Built by Mike Blakeway as a personal AI development workflow project and portfolio piece exploring agentic tooling, model routing, privacy-aware AI workflows, and cost-conscious developer productivity.
