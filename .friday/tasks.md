# Tasks

## Backlog

- [ ] Define the MVP as a no-provider local workflow engine.
- [ ] Integrate privacy classification, route recommendation, and cost estimates
      into the `plan` and `review` command output.
- [ ] Implement a `friday cost` command on top of the existing cost-estimation
      domain model.
- [ ] Add Git, TypeScript, test-runner, and Fallow evidence collection behind the
      evidence-provider foundation.
- [ ] Create an example project that demonstrates useful Friday memory and planning
      output.
- [ ] Improve the GitHub portfolio presentation with focused examples, screenshots
      or terminal captures, and an accurate roadmap.

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
- [x] Define `friday review --changed` as a local review-prompt workflow that
      consumes changed-file context, project memory, and evidence.
- [x] Reconcile public docs and project memory with the current implemented state.

## Later

- [ ] Add global developer memory and policy files alongside per-project memory.
- [ ] Integrate local models after routing and privacy policy are implemented.
- [ ] Integrate hosted providers only behind privacy, secret-detection, and
      cost-policy gates.
- [ ] Add usage logging, budgets, and cost reports by task, provider, and model.
- [ ] Add repeatable refactoring and shipping workflows.
- [ ] Explore a richer local cockpit interface once the CLI engine is proven.
- [ ] Explore voice interaction only after the core workflows are stable and useful.
