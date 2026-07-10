# Friday

**Friday is a local-first AI development cockpit for planning, designing, building and reviewing software with project memory, privacy-aware context handling, model routing and cost control.**

Friday was created to solve a real problem in modern AI-assisted development: powerful AI tools are now spread across chat apps, IDE plugins, coding agents and premium model subscriptions. That fragmentation creates repeated context sharing, inconsistent workflows, unnecessary cost, and unclear privacy boundaries.

Friday brings those workflows into one developer-owned system.

---

## Quick Start

Friday currently supports Node.js 18 or newer and a local model served by
[LM Studio](https://lmstudio.ai/). Install LM Studio, load a model, and enable
its local server before continuing.

Install the current release tarball:

```bash
npm install -g ./friday-0.1.0.tgz
```

Or install from a development checkout:

```bash
npm install
npm run build
npm link
```

Friday is not published to the npm registry yet. A future npm installation will
use `npm install -g friday`; do not use that command for the current release.

Configure one reusable local provider and verify the machine:

```bash
friday local setup
friday doctor
```

Then, from the project you want Friday to understand:

```bash
friday init
# Add useful context to the Markdown files under .friday/
friday evidence --collect
friday run plan "Recommend the next useful improvement"
```

`friday local setup` saves the selected local provider and model outside the
repository at `~/.friday/providers.json`. `friday init` creates inspectable
project memory without overwriting existing files. Evidence collection runs
local deterministic tools, and `friday run plan` shows the safety and cost
preflight before asking permission to call the configured local model.

The completed run leaves a prompt artefact, result artefact, and metadata-only
usage history under `.friday/`. Use `--yes` only when you want to approve a run
non-interactively.

To use Friday on its own repository after setup:

```bash
friday doctor
friday run plan "Review Friday and recommend the next smallest high-value improvement"
```

See the [first-run and Friday-on-Friday walkthrough](./docs/first-run.md) for a
polished terminal transcript, review workflow, generated artefacts, recovery
commands, and the commands used to verify this journey.

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

Friday's MVP is a local workflow engine with an explicit boundary between
deterministic preparation and optional local model execution. It should prove the
developer-owned workflow before adding hosted provider execution, API keys,
usage telemetry, cockpit UI, or autonomous coding.

The MVP-critical command path is:

```bash
friday init
friday local setup
friday doctor
friday evidence
friday run plan "<goal>"
friday run review --changed
friday plan "<goal>"
friday review --changed
friday route ...
friday cost --provider deepseek --model deepseek-v4-flash --input-tokens 12000 --output-tokens 3000
friday execute .friday/output/plan-prompt.md --provider local
```

This path should gather local project memory and deterministic evidence, apply
privacy and secret-safety policy, recommend a model route, estimate advisory
cost, and write inspectable artefacts. `friday run` provides a concise local
execution path while preserving the generated prompt, safety preflight, approval
boundary, result artefact, and usage log. Preparation commands such as `plan` and
`review` still do not call an AI provider, and their artefacts can be executed
separately with `friday execute`.

Demo work such as the example project and architecture diagram matters after the
local workflow is coherent, so it is positioned as presentation work rather than
MVP engine scope.

---

## Planned Features

Friday is currently in early development. The initial focus is on the core engine, not a polished UI.

### Foundation

- [x] Global developer memory
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
- [x] Optional LM Studio local provider adapter
- [x] Guided `friday local setup`
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
- [x] `friday run plan` and `friday run review --changed`
- [x] `friday route`
- [x] `friday cost`
- [x] `friday execute`
- [ ] `friday escalate` (post-MVP)

---

## Intended Workflow

The current local workflow uses the implemented local commands:

```bash
friday init
friday local setup
friday evidence
friday run plan "Build a lightweight AI code review assistant"
friday run review --changed
```

For inspect-first or scripted workflows, keep preparation and execution separate:

```bash
friday plan "Build a lightweight AI code review assistant"
friday review --changed
friday route --task review --privacy private-repo --complexity high --confidence standard --cost balanced
friday cost --provider deepseek --model deepseek-v4-pro --input-tokens 12000 --output-tokens 3000
friday execute .friday/output/plan-prompt.md --provider local
```

This workflow creates inspectable local artefacts and route recommendations.
`friday local setup` is a one-time, machine-level step that discovers LM Studio,
selects a loaded model, and writes reusable settings under `~/.friday/`; it does
not add provider configuration to the current repository.
`friday run plan` and `friday run review --changed` prepare the same prompt
artefacts, print a pre-execution policy and cost summary, ask for approval, and
execute through the configured default local provider/model. Pass `--yes` for
explicit non-interactive approval. Use `--provider lm-studio` and
`--model <loaded-model>` to override the configured selection for one run.
Secret-bearing prompts remain blocked before provider invocation, and missing or
unavailable provider configuration fails with setup guidance.
`friday plan` and `friday review` only prepare prompt artefacts by default.
`friday execute` is a deliberate second step that reads an existing prompt,
requires `--provider local`, rejects secret or blocked content before provider
invocation, checks local provider availability, and writes the model result under
`.friday/output/executions/`. It also appends metadata-only local usage history
under `.friday/runtime/execution-log.jsonl`; see
[local usage logging](./docs/local-usage-logging.md). The execute command loads
optional machine-level provider settings from `~/.friday/providers.json`,
discovers LM Studio on common localhost endpoints, and selects either the
configured model or the only loaded model. It does not require a `local-model`
alias. `friday cost` provides an advisory local estimate from configured
provider/model pricing and estimated token counts, while brainstorming,
specification, hosted provider execution, and explicit escalation commands
remain post-MVP.

The goal is not to replace the developer’s judgement. The goal is to reduce
friction, preserve context, manage cost, and make AI-assisted development easier
to control.

---

## Installation Reference

Friday v0.1.0 is packaged as a Node.js CLI. For this release, install from a
GitHub release asset or a local package tarball rather than the npm registry:

```bash
npm install -g ./friday-0.1.0.tgz
friday help
```

### First-time local model setup

Install and launch LM Studio, load at least one model, and start its local server.
Then run:

```bash
friday local setup
```

Friday detects the `lms` CLI and the OpenAI-compatible local server, lists the
loaded models, automatically selects a single model or asks you to choose when
several are available, and saves the result to `~/.friday/providers.json`. It
then offers a small test request. If the `lms` CLI is available but the server is
stopped, Friday offers to run `lms server start`; declining cancels setup without
changing configuration. Friday never downloads or loads a model for you.

For CI, scripts, or other non-interactive environments, provide every required
setting explicitly. Add `--test` to verify generation, or `--start-server` to
explicitly authorize the server-start process:

```bash
friday local setup \
  --provider lm-studio \
  --base-url http://127.0.0.1:1234/v1 \
  --model qwen3-coder-14b \
  --test
```

Setup errors explain how to handle a missing CLI, stopped or unavailable server,
no loaded models, an unavailable selected model, and a failed test request.

Check the installation, current project memory, optional global configuration,
and LM Studio readiness in one support-friendly report:

```bash
friday doctor
```

The normal diagnostic only queries the local OpenAI-compatible `/models`
endpoint. To also send a small local generation request to the selected model,
opt in explicitly:

```bash
friday doctor --test-provider
```

Example output:

```text
Friday diagnostics

Project
✓ .friday project memory found
✓ Project memory is readable and complete

Local provider
✓ LM Studio server reachable at http://127.0.0.1:1234/v1
✓ Model selected: qwen3-coder-14b
○ Test generation skipped

Friday is ready for local execution.
```

For local development from a checkout:

```bash
npm install
npm run build
npm link
friday help
```

Preparation commands do not require API keys and do not call AI providers.
Execution commands call only the explicitly configured localhost LM Studio
provider; Friday does not implement hosted-provider execution.

Friday also includes an optional code-level
[LM Studio local provider adapter](./docs/lm-studio-provider.md) for the
explicit local execution command. It does not create a hard dependency on LM
Studio for preparation, routing, evidence, or cost commands.

Local provider configuration is optional and stored outside repositories at
`~/.friday/providers.json`. See the provider guide for the versioned schema,
localhost discovery endpoints, and zero/one/multiple-model selection behavior.

See [Friday v0.1.0 release notes](./docs/releases/v0.1.0.md) for the release
summary and validation scope.

---

## Memory Structure

Friday uses two types of memory.

### Global Friday Memory

Global memory describes how the developer likes to work across repositories.

Example:

```txt
~/.friday/
  profile.md
  coding-standards.md
  model-policy.md
  privacy-policy.md
  cost-policy.md
  providers.json        # optional machine-level provider configuration
```

This memory is optional and reusable across projects. `friday plan` and
`friday review` load these files in the order shown above when they exist,
report which files were loaded or missing, and include loaded global memory
before project memory in generated prompts.

Global policy sets a floor. Project memory can add stricter privacy or secret
handling requirements, but it cannot silently weaken a stronger global privacy
classification. Exact duplicate global/project content is included once.

`providers.json` is configuration rather than memory: prompt builders do not
include it in generated context, and repository-specific `.friday/` directories
do not override it.

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

This memory describes the current project, its goals, architecture, design direction, decisions, and active tasks. Project memory is repository-scoped and should not contain reusable personal preferences that belong in `~/.friday/`.

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

- shaping technical plans
- generating project task lists
- reviewing changed files
- explaining failing tests
- planning refactors
- summarising pull requests
- inspecting local execution usage
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
planning and review prompts from local context, print privacy-aware route and
cost summaries for those workflows, preview model routes, classify privacy risk,
detect common secrets, estimate advisory model costs, and define
provider-agnostic model contracts. It can prepare and execute plan and changed-file
review workflows through a configured local LM Studio provider, preserving prompt
and result artefacts plus metadata-only usage history. It does not call hosted AI
providers.

Implemented CLI commands:

- `friday init`
- `friday status`
- `friday doctor [--test-provider]`
- `friday local setup [--provider lm-studio --base-url <url> --model <id>] [--start-server] [--test]`
- `friday evidence`
- `friday plan <goal...>`
- `friday review --changed`
- `friday run plan <goal...> [--yes] [--provider lm-studio] [--model <id>]`
- `friday run review --changed [--yes] [--provider lm-studio] [--model <id>]`
- `friday route`
- `friday cost --provider <provider> --model <model> --input-tokens <n> --output-tokens <n>`
- `friday execute <prompt-path> --provider local`

Planned CLI commands include `friday brainstorm`, `friday spec`, `friday design`,
and `friday escalate`.

Friday now includes a pure model-routing domain layer that recommends blocked,
local, cheap hosted, strong hosted, or premium routes from task and policy input.
The route preview makes no provider calls; hosted provider integrations remain
planned work.

Friday also includes a provider-agnostic `friday cost` command backed by the
cost estimation domain layer. It combines configured per-million input and
output token prices with estimated token counts to produce deterministic
advisory estimates. These estimates are not billing records and should be
treated as planning guidance rather than billing records. Local execution writes
real token usage and advisory estimates to metadata-only project history; Friday
does not publish telemetry.

Friday now includes a deterministic privacy safety gate for future AI provider
integrations. It classifies prompt or project context as public, internal,
private-repo, sensitive, or secret, detects common secret patterns, and blocks
secret context before any hosted model handoff. This foundation remains local
and provider-agnostic: it does not load credentials, call model SDKs, or make
network requests.

Friday can now compose that privacy classification with model routing for a raw
task prompt. Secret context returns a blocked route with no hosted alternatives,
sensitive context defaults to a local route, and safety warnings are returned as
user-facing text. This remains recommendation-only for hosted routes. The local
execution path re-applies the same safety policy before invocation.

Friday also includes provider-neutral interfaces, a deterministic mock provider,
and an LM Studio adapter for local execution. Hosted provider implementations,
API-key loading, streaming, and tool-call execution are not implemented.

The current MVP direction is a local-provider workflow engine that can:

1. initialise project memory
2. load project context
3. collect deterministic local evidence
4. classify request privacy and block secret-bearing context
5. route a task to an appropriate model tier without executing it
6. estimate advisory usage cost
7. create inspectable planning, review, cost, route, and evidence artefacts
8. execute planning and review through a configured local model with approval
9. record local result artefacts and metadata-only usage history

MVP-critical commands are `friday init`, `friday evidence`, `friday plan`,
`friday review`, `friday run`, `friday route`, `friday cost`, and the explicit
local execution boundary `friday execute --provider local`. Post-MVP work
includes hosted provider execution, budget reporting, autonomous coding, and a
richer cockpit UI.

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
- [x] Global memory loading
- [x] Project memory templates
- [x] Project memory loading
- [x] Basic tests

### Milestone 2 — Privacy and Cost

- [x] Privacy classification
- [x] Secret detection
- [x] Advisory cost estimation domain model
- [x] Built-in advisory model pricing
- [x] Local metadata-only usage logging
- [x] Advisory cost estimation CLI

### Milestone 3 — Model Routing

- [x] Provider interfaces
- [x] Routing rules
- [x] Route preview command
- [x] LM Studio local provider support
- [ ] Hosted provider support
- [ ] Escalation execution flow

### Milestone 4 — Core Workflows

- [ ] Brainstorm workflow
- [x] Planning prompt workflow
- [ ] Specification workflow
- [x] Code review prompt workflow
- [x] Advisory cost estimation workflow
- [x] Local evidence preparation workflow
- [x] Opt-in deterministic evidence collection

### Milestone 5 — Portfolio Polish

- [x] Architecture documentation
- [x] Example project
- [x] First-run terminal demonstration
- [x] Public roadmap
- [x] Usage examples

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
- Saved report artefacts for review and triage

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

Evidence providers are structural project signals, separate from AI model
providers. `friday evidence --collect` can run local Git, TypeScript, test, and
Fallow commands and records failures as evidence instead of calling an AI model.

---

## Contributing

Friday is currently an early-stage personal and portfolio project, but it uses a lightweight professional workflow for issues, branches, pull requests and CI.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch naming convention and contribution workflow.

---

## License

MIT. See [LICENSE](./LICENSE).

---

## Author

Built by Mike Blakeway as a personal AI development workflow project and portfolio piece exploring agentic tooling, model routing, privacy-aware AI workflows, and cost-conscious developer productivity.
