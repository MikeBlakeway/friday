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
