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
