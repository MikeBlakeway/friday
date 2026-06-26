# Friday

**Friday is a local-first AI development cockpit for planning, designing, building and reviewing software with project memory, privacy-aware context handling, model routing and cost control.**

Friday was created to solve a real problem in modern AI-assisted development: powerful AI tools are now spread across chat apps, IDE plugins, coding agents and premium model subscriptions. That fragmentation creates repeated context sharing, inconsistent workflows, unnecessary cost, and unclear privacy boundaries.

Friday brings those workflows into one developer-owned system.

---

## Why Friday Exists

Modern AI-assisted development is powerful, but messy.

A typical workflow can easily involve:

* ChatGPT or Claude for brainstorming
* another AI tool for specifications
* another for design and wireframes
* Copilot or Codex-style tools for code generation
* premium models for complex debugging and review
* repeated manual copying of project context between tools

This creates real problems for developers:

* project context gets lost between tools
* premium models are overused for low-risk work
* AI agents can burn through tokens unnecessarily
* privacy decisions are often unclear
* usage cost is difficult to understand
* developer focus is lost to tool switching

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

## Planned Features

Friday is currently in early development. The initial focus is on the core engine, not a polished UI.

### Foundation

* [ ] Global developer memory
* [ ] Per-project memory
* [ ] Project initialisation
* [ ] Workflow-specific prompt templates
* [ ] Strongly typed TypeScript architecture

### Privacy and Safety

* [ ] Prompt privacy classification
* [ ] Secret detection
* [ ] Local-first routing for sensitive context
* [ ] Hosted model blocking for unsafe prompts

### Model Routing

* [ ] Provider-agnostic model interface
* [ ] Local model support
* [ ] DeepSeek provider support
* [ ] OpenAI provider support
* [ ] Anthropic provider support
* [ ] Task-based model routing
* [ ] Premium escalation flow

### Cost Control

* [ ] Token usage logging
* [ ] Estimated cost tracking
* [ ] Cost report by task
* [ ] Cost report by provider/model
* [ ] Budget rules

### Developer Workflows

* [ ] `friday init`
* [ ] `friday brainstorm`
* [ ] `friday plan`
* [ ] `friday spec`
* [ ] `friday design`
* [ ] `friday review`
* [ ] `friday cost`
* [ ] `friday escalate`

---

## Intended Workflow

A future Friday workflow may look like this:

```bash
friday init
friday brainstorm "Build a lightweight AI code review assistant"
friday plan
friday spec
friday review --changed
friday cost
friday escalate review
```

The goal is not to replace the developer’s judgement. The goal is to reduce friction, preserve context, manage cost, and make AI-assisted development easier to control.

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
```

This memory describes the current project, its goals, architecture, design direction, decisions, and active tasks.

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

The guiding rule:

> Start with the cheapest safe option and escalate only when the task earns the cost.

---

## Example Use Cases

Friday is intended to help with:

* brainstorming product ideas
* shaping technical plans
* creating implementation specs
* generating project task lists
* reviewing changed files
* explaining failing tests
* planning refactors
* summarising pull requests
* tracking AI usage cost
* deciding when premium model escalation is justified

---

## What Friday Is Not

Friday is not intended to be:

* a general chatbot clone
* a full IDE replacement
* a fully autonomous coding agent
* a vendor-specific wrapper
* a tool that sends entire repositories to hosted models by default
* a way to avoid senior engineering judgement

Friday is a workflow layer for developers who want more control over AI-assisted software work.

---

## Current Status

Friday is currently at the planning and foundation stage.

The first milestone is to create a TypeScript CLI that can:

1. initialise project memory
2. load global and project context
3. classify request privacy
4. route a task to an appropriate model
5. estimate and log usage cost
6. support a small number of repeatable workflows

---

## Tech Stack

Planned initial stack:

* TypeScript
* Node.js
* CLI-first interface
* Markdown-based memory
* JSON/JSONL configuration and logging
* Vitest for testing
* Provider-agnostic AI interfaces

Future possibilities:

* local model integration
* hosted model integrations
* interactive terminal UI
* desktop or web cockpit
* voice-enabled workflows
* richer project memory and retrieval

---

## Roadmap

### Milestone 1 — Foundation

* Project structure
* CLI skeleton
* Global memory templates
* Project memory templates
* Config loading
* Basic tests

### Milestone 2 — Privacy and Cost

* Privacy classification
* Secret detection
* Model pricing config
* Usage logging
* Cost reporting

### Milestone 3 — Model Routing

* Provider interfaces
* Routing rules
* Local provider support
* Hosted provider support
* Escalation flow

### Milestone 4 — Core Workflows

* Brainstorm workflow
* Planning workflow
* Specification workflow
* Code review workflow
* Cost reporting workflow

### Milestone 5 — Portfolio Polish

* Architecture documentation
* Example project
* Demo screenshots or GIF
* Public roadmap
* Usage examples

---

## Project Motivation

Friday is built from a real developer pain point.

AI tools can be incredibly useful, but experienced developers increasingly need to manage:

* which model to use
* how much context to provide
* what data is safe to share
* whether the output is worth the cost
* how to keep project knowledge consistent
* how to avoid tool sprawl

Friday explores what a more deliberate AI development workflow could look like.

---

## License

TBC.

---

## Author

Built by Mike Blakeway as a personal AI development workflow project and portfolio piece exploring agentic tooling, model routing, privacy-aware AI workflows, and cost-conscious developer productivity.
