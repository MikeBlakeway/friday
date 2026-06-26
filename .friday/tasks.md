# Tasks

## Backlog

- [ ] Design a provider abstraction for local and hosted model implementations.
- [ ] Add cost-estimation types and a transparent estimate for proposed routes.
- [ ] Compose privacy classification with model routing so classified requests can
      be routed or blocked automatically.
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

## Later

- [ ] Add global developer memory and policy files alongside per-project memory.
- [ ] Integrate local models after routing and privacy policy are implemented.
- [ ] Integrate hosted providers only behind privacy, secret-detection, and
      cost-policy gates.
- [ ] Add usage logging, budgets, and cost reports by task, provider, and model.
- [ ] Add repeatable refactoring and shipping workflows.
- [ ] Explore a richer local cockpit interface once the CLI engine is proven.
- [ ] Explore voice interaction only after the core workflows are stable and useful.
