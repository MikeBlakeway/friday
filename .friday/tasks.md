# Tasks

## Backlog

- [ ] Add post-MVP cross-project usage reporting and budget policy.
- [ ] Add hosted-provider execution behind privacy, secret, routing, and cost
      gates.

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
- [x] Define model-routing domain types for tasks, capabilities, privacy, cost, and
      routing outcomes.
- [x] Define a model policy that selects the cheapest safe model and describes
      explicit escalation conditions.
- [x] Added deterministic privacy classification for prompts and project context.
- [x] Added deterministic secret detection and secret-context blocking before
      hosted-model integrations.
- [x] Composed privacy classification with model routing so raw task prompts can
      be routed, warned, or blocked automatically.
- [x] Add provider-agnostic model interfaces and a deterministic mock provider.
- [x] Add advisory cost-estimation types and deterministic cost calculation.
- [x] Implement `friday evidence` to prepare evidence provider files and write an
      inspectable evidence pack.
- [x] Add opt-in Git, TypeScript, test-runner, and Fallow evidence collection via
      `friday evidence --collect`.
- [x] Define `friday review --changed` as a local review-prompt workflow that
      consumes changed-file context, project memory, and evidence.
- [x] Implement `friday cost` as an advisory CLI command on top of the
      cost-estimation domain model.
- [x] Integrate privacy classification, route recommendation, and cost estimates
      into the `plan` and `review` command output.
- [x] Create an example project that demonstrates useful Friday memory and planning
      output.
- [x] Define the MVP around deterministic preparation and explicit local-model
      execution.
- [x] Reconcile public docs and project memory with the current implemented state.
- [x] Prepare Friday v0.1.0 release packaging and release notes.
- [x] Add guided LM Studio discovery, model selection, global configuration, and
      optional verification through `friday local setup`.
- [x] Add one-command local plan and review execution while preserving prompt,
      result, and usage artefacts.
- [x] Add safe global-memory preparation with previews, explicit unattended
      flags, and preservation of existing developer-authored files.
- [x] Polish onboarding, grouped CLI help, recovery guidance, terminal examples,
      and the Friday-on-Friday walkthrough.
- [x] FRI-053: normalise LM Studio reasoning responses, diagnose empty output, and
      record failed attempts without prompts or hidden reasoning.
- [x] FRI-056: add reasoning-aware workflow output allowances and one bounded,
      context-safe retry for implicit ceilings.
- [x] FRI-058: add TTY-aware workflow progress and print a redacted, bounded local
      assistant response while preserving execution artefacts.
- [x] FRI-060: reconcile public documentation and dogfooded project memory after
      the successful Friday-on-Friday local planning run.
- [x] FRI-061: expose metadata-only execution history through a read-only local
      usage summary with time filtering and workflow/model grouping.

## Later

- [ ] Integrate hosted providers only behind privacy, secret-detection, and
      cost-policy gates.
- [ ] Add budgets and aggregate cost reports by task, provider, and model.
- [ ] Add repeatable refactoring and shipping workflows.
- [ ] Explore a richer local cockpit interface once the CLI engine is proven.
- [ ] Explore voice interaction only after the core workflows are stable and useful.
