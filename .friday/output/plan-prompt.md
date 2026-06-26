# Friday Planning Prompt

## Goal

Build the model routing layer

## Instructions

You are helping plan the next step for this software project.

Use the project memory and evidence below.

Prioritise:

- practical implementation steps
- strongly typed TypeScript
- privacy-aware design
- cost-conscious AI usage
- simple architecture
- clear trade-offs
- small incremental delivery

Do not invent existing code or project decisions.
If context is missing, say what is missing.

## Project Memory

### project.md

# Project

## Name

Friday

## Purpose

Friday is a local-first AI development cockpit for developers who want control over
project memory, privacy, model choice, and AI usage cost. It provides a
developer-owned workflow layer that preserves reusable context, gathers evidence,
and supports deliberate AI-assisted software work.

Friday exists because modern AI development workflows are fragmented across chat
tools, IDE plugins, coding agents, and model subscriptions. That fragmentation
causes repeated context sharing, inconsistent workflows, unclear privacy
boundaries, and unnecessary cost.

## Target Users

- Mike, as a personal workflow tool for planning and shipping software with more
  control over context and AI usage.
- Experienced developers and technical teams who want local, reviewable project
  memory and practical AI workflows rather than another general-purpose chatbot.
- Portfolio reviewers evaluating senior-level thinking in AI tooling, developer
  platforms, privacy boundaries, and cost-aware system design.

## Current Stage

Early CLI-first foundation. Friday can initialise and inspect per-project memory,
build a planning prompt from that memory, and include manually supplied evidence.
Model routing, privacy classification, cost tracking, and provider integrations are
not implemented yet.

## Core Goals

- Keep project context under developer control in local, readable Markdown files.
- Make planning and later workflows repeatable instead of chat-session dependent.
- Gather deterministic evidence before asking an LLM to reason about a project.
- Route future tasks to the cheapest safe model, escalating only when justified.
- Protect sensitive context and prevent secrets from reaching hosted models.
- Maintain a strongly typed, practical TypeScript codebase with small incremental
  delivery.

## Non-Goals

- A general chatbot, full IDE replacement, or vendor-specific wrapper.
- Autonomous coding or unattended repository changes in the first version.
- Sending complete repositories or sensitive context to hosted models by default.
- A voice-first or GUI-first product before the local workflow engine is proven.
- Replacing developer judgement with opaque automation.

## Tech Stack

- Runtime: Node.js
- Language: TypeScript with native ES modules
- CLI: local Node.js executable, currently built around `init`, `status`, and
  `plan` commands
- Testing: Vitest
- Tooling: TypeScript compiler, Prettier, and Fallow static analysis
- Project memory: Markdown files in `.friday/`

## Open Questions

- What task taxonomy and model policy provide useful routing without premature
  complexity?
- How should privacy classification and secret detection combine before any hosted
  provider request is allowed?
- Which local and hosted providers best support a provider-agnostic first
  integration?
- What cost-estimation precision is useful before real provider usage telemetry is
  available?
- Which workflow should follow planning: evidence collection, review, or model
  routing?

### architecture.md

# Architecture

## Overview

Friday is a local, CLI-first TypeScript application. Its current architecture keeps
project memory, deterministic evidence, prompt construction, and command handling
separate so later model routing and provider integrations can be added without
coupling them to file-system concerns.

Per-project memory lives in `.friday/` beside the source repository. The CLI reads
that memory, builds a structured planning prompt, and writes generated artefacts
back to `.friday/output/`. Friday does not call an AI provider in the current
implementation.

## Current Modules

- **CLI commands** — dispatch command-line workflows. Implemented commands are
  `friday init`, `friday status`, and `friday plan`; other workflow commands are
  currently placeholders or planned.
- **Core project memory** — defines the `.friday/` file set, creates templates,
  checks project status, and loads existing memory files.
- **File-system helpers** — provide small async operations for checking paths and
  reading or writing local files.
- **Evidence providers foundation** — defines typed evidence summaries and known
  evidence-file names. Manual Markdown evidence parsing is implemented; other
  provider outputs are planned.
- **Planning prompt builder** — combines a goal, non-empty project memory, and
  available evidence into a provider-neutral Markdown prompt.
- **Generated output** — stores planning prompts under
  `.friday/output/plan-prompt.md` so they are inspectable before any model use.

## Data Flow: `friday plan`

1. The CLI receives `friday plan <goal...>` from the current repository root.
2. The command verifies that `.friday/` exists and reads optional manual evidence
   from `.friday/evidence/manual.md` when present.
3. The project-memory loader reads the six expected `.friday/*.md` files and keeps
   missing files explicit rather than failing the workflow.
4. The planning prompt builder includes the goal, non-empty memory files, and
   parsed evidence in a structured Markdown prompt.
5. The command writes the result to `.friday/output/plan-prompt.md` and reports
   the loaded memory files and evidence count.
6. A developer can review or paste that prompt into a chosen model. Friday makes
   no model request at this stage.

## Important Boundaries

- **Project memory versus generated output:** source memory is human-maintained;
  generated prompts are derived artefacts under `.friday/output/`.
- **Deterministic evidence versus LLM reasoning:** evidence collection and parsing
  should establish facts before an LLM is asked to interpret them.
- **Core workflow versus AI providers:** planning currently produces a neutral
  prompt, preserving provider choice and avoiding provider lock-in.
- **Local context versus hosted services:** future routing must apply privacy and
  secret checks before any context is sent outside the developer environment.
- **Global versus project memory:** global developer preferences and project
  context are conceptually distinct. The current implementation starts only with
  per-project memory in `.friday/`.

## Future Architecture Areas

- Model-routing domain types, task classification, and a model policy layer.
- Provider-agnostic interfaces for local and hosted model integrations.
- Privacy classification, secret detection, and hosted-provider blocking rules.
- Cost estimation, usage logging, budget policy, and cost reporting.
- Additional deterministic evidence providers for Git, TypeScript, tests, and
  Fallow output.
- Repeatable review, refactoring, and shipping workflows built on the same core
  memory and evidence boundaries.

### decisions.md

# Decisions

### 2026-06-26 — Treat Agent Skills as a future interoperability layer

**Context**

Agent Skills using `SKILL.md` are becoming a common convention across AI coding tools. Claude, Codex and VS Code Copilot all support or document skill-style workflows.

**Decision**

Friday will not implement `SKILL.md` support in the foundation phase. Friday will first prove its own core concepts: project memory, evidence, planning prompts, privacy, cost control and model routing.

**Reasoning**

Skills are useful for packaging repeatable workflows, but adopting them too early could make Friday a wrapper around external agent conventions rather than a developer-owned workflow system.

**Trade-offs**

Delaying support means Friday will not immediately interoperate with external skill-based agents. The benefit is that Friday’s internal workflow model can mature first. Later, Friday can support skills as an import/export or workflow packaging layer.

### 2026-06-26 — Use the name Friday with professional public positioning

**Context**

The name Friday has familiar fictional associations that could make the project
appear novelty-driven.

**Decision**

Keep the name Friday, while positioning it publicly as a local-first AI development
cockpit for project memory, privacy, model choice, and cost control.

**Reasoning**

The name is concise and memorable, while the product framing makes the intended
audience and engineering value clear.

**Trade-offs**

The name may invite informal references, so documentation and product language
must remain practical, specific, and professional.

### 2026-06-26 — Separate global and project memory conceptually; begin with project memory

**Context**

Friday needs reusable developer preferences and repository-specific context, but
introducing both storage layers immediately would expand the first implementation.

**Decision**

Model global Friday memory and per-project Friday memory as separate concepts, but
implement per-project memory first.

**Reasoning**

Project memory directly supports the initial CLI workflows and establishes the
format, loading model, and trust boundary before global preferences are added.

**Trade-offs**

Early users cannot yet centrally configure personal policies across projects.

### 2026-06-26 — Store project-specific memory in `.friday/`

**Context**

Project context needs to be local, visible, versionable, and available to CLI
commands without dependence on a hosted service.

**Decision**

Use a `.friday/` directory inside each repository for project-specific Markdown
memory and generated Friday output.

**Reasoning**

The directory keeps context next to the code it describes, makes changes
reviewable, and supports local-first operation.

**Trade-offs**

Teams must decide which memory and generated files belong in version control.

### 2026-06-26 — Start with a CLI-first implementation

**Context**

Friday needs to prove useful workflows before investing in an interactive product
surface.

**Decision**

Prioritise a Node.js CLI and Markdown artefacts for the first version.

**Reasoning**

A CLI is easy to automate, works with existing developer tools, and keeps the
initial scope focused on the workflow engine.

**Trade-offs**

The early experience is less discoverable and less visual than a dedicated
interface.

### 2026-06-26 — Keep first workflows local-first and provider-agnostic

**Context**

Provider-specific integrations would create lock-in and force privacy and billing
decisions before Friday has a stable workflow core.

**Decision**

Build local prompt, memory, and evidence workflows first. Keep provider calls out
of the current implementation and define future integrations behind neutral
interfaces.

**Reasoning**

This preserves model choice, supports inspection before data leaves the machine,
and allows value before provider integrations exist.

**Trade-offs**

Users must manually take generated prompts to a model until provider integrations
are introduced.

### 2026-06-26 — Treat Fallow as an evidence provider, not an AI provider

**Context**

Static-analysis output can inform planning and review, but it does not generate
model responses.

**Decision**

Classify Fallow as a deterministic evidence provider alongside future Git,
TypeScript, and test-runner evidence sources.

**Reasoning**

Separating evidence from AI providers keeps facts distinct from generated
reasoning and makes the architecture easier to test and trust.

**Trade-offs**

Friday must define normalised evidence formats and collection workflows before
Fallow output can be consumed automatically.

### 2026-06-26 — Implement `friday plan` as a prompt and context builder first

**Context**

Planning is useful immediately, but direct model calls would prematurely couple
prompt generation to authentication, provider selection, privacy policy, and cost.

**Decision**

Make `friday plan` load project memory and evidence, build a structured prompt,
and write it to `.friday/output/plan-prompt.md` without invoking a model.

**Reasoning**

The command validates the memory and planning workflow while preserving developer
review and provider choice.

**Trade-offs**

The workflow has a manual handoff until model routing and provider integrations
are added.

### 2026-06-26 — Delay voice, GUI, and autonomous coding

**Context**

Interactive interfaces and autonomous actions add substantial product, safety, and
operational complexity.

**Decision**

Treat voice, a richer cockpit UI, and autonomous coding as long-term possibilities
rather than near-term implementation targets.

**Reasoning**

Friday first needs a reliable local engine for memory, evidence, policy, and
routing.

**Trade-offs**

The early product remains intentionally narrow and command-line oriented.

### design.md

# Design

## Product Feel

Friday should feel professional, practical, calm, and useful: a focused developer
tool that helps users make better decisions with less context switching. It should
communicate clear boundaries, concrete outputs, and honest uncertainty rather than
performing as a conversational novelty.

## Developer Experience Principles

- Prefer local, inspectable files and deterministic output over opaque automation.
- Make the next useful action obvious and keep command output concise.
- Preserve user control: show what context was loaded, what evidence was used, and
  what would be shared before any future model call.
- Design for progressive capability: core workflows should remain useful without
  model integrations, then gain routing and provider support without changing their
  fundamental shape.
- Use simple defaults, explicit policy, and small incremental workflows instead of
  large autonomous operations.
- Treat privacy, cost, and model choice as first-class product concerns, not
  configuration afterthoughts.

## CLI Direction

The CLI is the current product surface. Commands should read like predictable
developer tooling: accept a clear goal, report local inputs and generated outputs,
and leave an inspectable artefact. Error messages should identify the missing local
prerequisite and the exact next command where possible.

## Future Cockpit Direction

A future interactive cockpit may provide a compact view of project memory, evidence,
model-routing decisions, privacy status, cost, and workflow history. It should sit
on top of the same local engine and files rather than become a separate source of
truth. The interface should prioritise clarity and reviewability over decorative
visual complexity.

Voice is a long-term interaction idea only. It is not part of the current product
scope and should not shape the CLI-first architecture.

## Public Brand Tone

Use direct, technically credible language. Position Friday as an AI workflow and
developer productivity project that demonstrates thoughtful platform engineering.
Avoid superhero references, toy-like metaphors, or claims that exceed implemented
capabilities.

### tasks.md

# Tasks

## Backlog

- [ ] Define model-routing domain types for tasks, capabilities, privacy, cost, and
      routing outcomes.
- [ ] Define a model policy that selects the cheapest safe model and describes
      explicit escalation conditions.
- [ ] Design a provider abstraction for local and hosted model implementations.
- [ ] Add cost-estimation types and a transparent estimate for proposed routes.
- [ ] Add privacy classification for project context and prompts.
- [ ] Add secret detection and prevent unsafe hosted-model requests.
- [ ] Implement an `evidence` command that gathers normalised deterministic
      evidence.
- [ ] Add Git, TypeScript, test-runner, and Fallow evidence collection behind the
      evidence-provider foundation.
- [ ] Define a review workflow that consumes project memory and evidence.
- [ ] Polish documentation around local-first boundaries, model policy, and current
      capability.
- [ ] Create an example project that demonstrates useful Friday memory and planning
      output.
- [ ] Improve the GitHub portfolio presentation with focused examples, screenshots
      or terminal captures, and an accurate roadmap.

## In Progress

- [ ] Shape the model-routing layer from Friday's own populated project memory.

## Done

- [x] Establish the Node.js and strongly typed TypeScript CLI foundation.
- [x] Implement `friday init` to create the standard per-project memory files.
- [x] Implement `friday status` to report the expected project-memory files.
- [x] Implement project-memory loading for the six `.friday/*.md` files.
- [x] Implement `friday plan` as a local planning-prompt builder that writes
      `.friday/output/plan-prompt.md`.
- [x] Add typed evidence summaries and manual Markdown evidence parsing.
- [x] Establish Fallow reporting and project quality checks.
- [x] Populate Friday's own project memory to dogfood the planning workflow.

## Later

- [ ] Add global developer memory and policy files alongside per-project memory.
- [ ] Integrate local models after routing and privacy policy are implemented.
- [ ] Integrate hosted providers only behind privacy, secret-detection, and
      cost-policy gates.
- [ ] Add usage logging, budgets, and cost reports by task, provider, and model.
- [ ] Add repeatable refactoring and shipping workflows.
- [ ] Explore a richer local cockpit interface once the CLI engine is proven.
- [ ] Explore voice interaction only after the core workflows are stable and useful.

### notes.md

# Notes

- Avoid overbuilding. Prove the local workflow engine with small, useful commands
  before adding a GUI, voice, autonomous coding, or broad provider support.
- Prefer cheap and local models first in future routing, subject to task capability,
  privacy policy, and explicit developer choice.
- Never send secrets, credentials, tokens, or sensitive context to hosted models.
  Future hosted requests must pass privacy classification and secret-detection
  checks first.
- Prioritise strongly typed TypeScript, small modules, explicit interfaces, and
  testable boundaries.
- Gather deterministic evidence before asking an LLM to reason. Fallow, Git,
  TypeScript, and test results should inform later workflows as evidence, not be
  conflated with AI-provider output.
- Friday must remain useful before model integrations exist. Local memory,
  structured prompts, evidence, and inspectable output are valuable on their own.
- Do not claim planned routing, provider integration, privacy enforcement, or cost
  tracking as implemented until the relevant code and verification exist.
- Keep generated artefacts under `.friday/output/` distinct from the human-curated
  project memory files.

## Evidence

No additional evidence was provided.

## Required Output

Return:

1. Recommended approach
2. Implementation steps
3. Files likely to change
4. Risks and trade-offs
5. Questions to resolve
6. Suggested first commit
