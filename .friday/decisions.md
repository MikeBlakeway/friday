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

**Status: Superseded on 2026-07-13 by optional global developer memory.**

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

**Status: Superseded on 2026-07-13 for local execution; hosted execution remains deferred.**

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

**Status: Implemented and extended to Git, TypeScript, and test collection.**

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

**Status: Retained for preparation and extended by explicit local execution.**

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

### 2026-06-26 — Build model routing as a pure policy layer before provider integrations

**Status: Retained as policy and extended by guarded local execution.**

**Context**

Friday needs to decide which model tier is appropriate before it can safely call any provider.

**Decision**

Implement model routing as a pure, deterministic TypeScript policy that returns route recommendations without making provider calls.

**Reasoning**

This keeps routing testable, provider-agnostic, privacy-aware and cost-conscious before API keys, billing or network calls are introduced.

**Trade-offs**

The route is only advisory until provider integrations and enforcement gates are implemented.

### 2026-06-26 — Add privacy safety before provider integrations

**Context**

Friday needs deterministic privacy and secret-safety inputs before any hosted
model provider calls exist.

**Decision**

Friday classifies prompt and project context, detects common secrets, and blocks
secret context before adding any hosted-model provider calls.

**Reasoning**

Provider routing decisions need a deterministic privacy input before credentials,
SDKs, or network calls exist. Building the safety gate first makes later
integrations easier to test and reduces the chance that private repository
context, sensitive data, or secrets are accidentally sent to hosted models.

**Trade-offs**

The privacy layer remains pure TypeScript with no runtime dependencies or
provider behavior. Secret context is blocked locally, and future routing
composition can reuse the existing `PrivacyLevel` vocabulary instead of
introducing a second policy model.

### 2026-07-07 — Compose privacy classification before route recommendation

**Status: Retained and enforced by the local execution preflight.**

**Context**

Friday now has both a deterministic privacy classifier and a provider-neutral
route policy, but callers need a single safe entrypoint for raw task prompts.

**Decision**

Compose prompt privacy classification, secret detection, and model routing before
any provider integration. The composed result exposes the generated route input,
the classification, the recommendation, and user-facing warnings.

**Reasoning**

Provider calls should only happen after the request has been classified and
routed through the same privacy vocabulary. This ensures secret context cannot
produce a hosted route and sensitive context defaults local.

**Trade-offs**

The composed route remains recommendation-only until provider interfaces exist.
That keeps the boundary deterministic and testable while still giving future
callers a single policy entrypoint.

### 2026-07-13 — Permit explicit local LM Studio execution

**Context**

Friday's inspectable prompt workflows, privacy classification, route policy, and
provider-neutral contracts now provide the gates needed for deliberate local
model use.

**Decision**

Support plan and changed-file review execution through a configured localhost LM
Studio provider. Keep prompt preparation useful without a model, preserve prompt
and result artefacts, re-run safety policy before invocation, and require explicit
interactive approval or `--yes`. Hosted-provider execution remains out of scope.

**Reasoning**

This closes the local planning loop without introducing credentials, hosted data
transfer, or an opaque automation path.

**Trade-offs**

Users must run LM Studio and load a compatible model. Friday does not download
models, silently start provider processes, or support hosted fallbacks.

### 2026-07-13 — Store provider configuration at machine level

**Context**

Local endpoints, loaded model identifiers, and context limits describe a machine,
not a repository or a developer's prompt memory.

**Decision**

Store validated local provider settings in `~/.friday/providers.json`. Keep the
file outside project memory, never include it in prompts, restrict endpoints to
localhost HTTP, reject credential-like arbitrary fields, and require explicit
consent before any server-start action.

**Reasoning**

One inspectable machine-level configuration can be reused across repositories
without committing machine state or conflating configuration with model context.

**Trade-offs**

Repository checkouts are not self-contained for execution and each machine needs
its own setup.

### 2026-07-13 — Load optional global developer memory

**Context**

The project-memory-only foundation proved the local file format, but reusable
developer preferences and policy should not be copied into every repository.

**Decision**

Load optional Markdown memory from `~/.friday/` before project memory. Provide
`friday global init` as a previewed, confirmation-gated, non-overwriting setup;
deduplicate exact content and let global privacy policy set a floor that project
memory cannot weaken.

**Reasoning**

This adds reusable context while preserving readable files, explicit setup, and a
clear separation between developer policy and repository facts.

**Trade-offs**

Prompt inputs can now depend on files outside the repository, so Friday reports
which global files were loaded or missing.

### 2026-07-13 — Record metadata-only local usage and outcomes

**Status: Extended by separate outcome events and hosted-budget policy evaluation.**

**Context**

Advisory estimates alone cannot show how an actual local execution behaved, but
full prompt or response logging would duplicate sensitive project context.

**Decision**

Append local success and failure metadata to
`.friday/runtime/execution-log.jsonl`, including workflow, route, provider/model,
timing, token usage, advisory cost, stop reason, error code, privacy classification,
and optional legacy developer outcome. Exclude raw prompts, secrets, hidden
reasoning, and unredacted provider responses. Structured developer judgement now
lives in the separate append-only outcome log.

**Reasoning**

Metadata supports inspectable routing and outcome history without turning Friday
into published telemetry or a prompt replay store.

**Trade-offs**

The log is project-local and intentionally incomplete. Cross-project aggregate
usage reporting and richer cost reports remain planned. Hosted-budget evaluation
is implemented, but runtime enforcement remains deferred until Friday invokes a
hosted provider.

### 2026-07-14 — Validate execution-history schema before safety evaluation

**Decision**

Validate every version-1 execution-log record at read time before usage summaries
or hosted-budget evaluation consume it. Reject malformed route, timestamp,
token, cost, privacy, result, outcome, and override fields with the exact JSONL
line and field path. Version 1 remains supported; unsupported older versions
must be repaired or migrated explicitly rather than being treated as current.

**Reasoning**

Execution history is developer-owned but informs financial safety policy. A
partial write or manual edit must not create misleading totals or cause a later
generic dereference failure.

### 2026-07-13 — Expose execution history through a read-only local summary

**Status: Extended by outcome-log summaries and hosted-budget reporting.**

**Context**

Metadata-only execution records were inspectable as JSONL but did not yet answer
routine questions about real token usage, outcomes, workflow mix, or model choice
from the CLI.

**Decision**

Add `friday usage` on top of the existing read and summary helpers. Report real
recorded token totals and advisory cost, support completion-time filtering and
workflow/provider-model grouping, and preserve the metadata-only privacy boundary.

**Reasoning**

A deterministic read-only view validates the local history model and provides
evidence for later budget policy without introducing telemetry or enforcement.

**Trade-offs**

The summary is project-local, advisory, and non-billing. Local-model financial
cost may be zero; cross-project reporting remains planned. Hosted-budget policy
evaluation now exists, while hosted execution-time enforcement remains deferred.

### 2026-07-14 — Record developer judgement as separate append-only events

**Context**

A successful provider response only proves that execution completed. It does not
show whether the developer accepted the result, retried it, escalated it, or
rejected it, and adding free text would expand the privacy surface.

**Decision**

Add `friday outcome <execution-id|latest> <status>` with four structured statuses
and no free-text reason. Store versioned events in
`.friday/runtime/outcome-log.jsonl`, require exact identifiers in non-interactive
use, and confirmation-gate `latest` after displaying its execution metadata.
Later events supersede the effective usage-summary value without rewriting or
deleting earlier history.

**Reasoning**

Separate events preserve auditability and keep developer judgement distinct from
provider execution status while retaining Friday's metadata-only privacy boundary.

**Trade-offs**

The first version cannot explain why an outcome was chosen or link retries and
escalations to a subsequent execution. Those relationships can be added later as
structured fields if they prove useful without weakening privacy defaults.

### 2026-07-13 — Use reasoning-aware allowances and one bounded adaptive retry

**Context**

Reasoning-capable local models can consume an output allowance before producing a
final answer, and generic low defaults caused valid Friday-on-Friday runs to end at
the token limit.

**Decision**

Use shared workflow defaults of 4,000 output tokens for plan, 3,000 for review,
and 2,000 for other explicit tasks. Respect explicit `--max-output-tokens`
ceilings. When an implicit allowance ends with `output-limit-exhausted`, permit at
most one bounded adaptive retry within known model and context limits.

**Reasoning**

The policy gives supported reasoning models room to finish while keeping token
use visible, predictable, and bounded.

**Trade-offs**

Implicit runs may make a second local request. Explicit ceilings disable retry,
and unknown or insufficient context limits fail without silently expanding use.

### 2026-07-14 — Distinguish provider attempts from developer retry judgements

**Context**

The execution log recorded each provider invocation but did not link attempts
from one logical run. As a result, `friday usage` labelled developer-recorded
`retried` outcomes as generic retries, which obscured real adaptive execution.

**Decision**

Add optional metadata-only provider-attempt fields: a generated workflow-run
identifier, one-based attempt number, and `adaptiveRetry`. New local executions
record every provider attempt with that relationship; older version-1 records
without it remain readable as one workflow run, one provider attempt, and zero
adaptive retries. Usage now reports workflow runs, provider attempts, adaptive
provider retries, attempt results, and developer-recorded outcomes separately.

**Reasoning**

This makes a failed `output-limit-exhausted` attempt followed by a successful
retry inspectable without storing prompts, responses, reasoning, secrets, or
developer free text. Outcome events remain append-only and latest-event-wins.

### 2026-07-13 — Keep live generated output local

**Context**

Friday's own successful workflow created prompts, execution results, evidence, and
runtime history containing machine- and run-specific context. The repository also
uses curated prompt examples as durable product documentation.

**Decision**

Ignore live `.friday/output/plan-prompt.md`,
`.friday/output/review-prompt.md`, `.friday/output/executions/`,
`.friday/evidence/`, and `.friday/runtime/`. Commit only deliberately curated and
redacted `*.example.md` artefacts when they add documentation value.

**Reasoning**

This keeps human-maintained memory reviewable and prevents transient or sensitive
run data from entering version control while retaining safe examples.

**Trade-offs**

Real execution history is local to each checkout and is not reproduced from Git.

### 2026-07-14 — Evaluate hosted financial budgets from existing local history

**Status: Retained; evaluation and preflight are implemented, hosted invocation is deferred.**

**Context**

Future hosted providers need an explicit spend boundary, but Friday must not add
provider billing APIs, another usage store, or a cost override that could weaken
privacy and secret safety.

**Decision**

Use versioned global and project `budget-policy.json` files to define an
aggregate calendar-month hosted-cost warning and/or hard limit. Read the existing
`.friday/runtime/execution-log.jsonl` history, merge both layers to the stricter
ceiling, and surface the current-project state through `friday usage --budget`.
Model warning acknowledgement and permitted hard-limit overrides as structured,
metadata-only preflight results for a future hosted invocation.

**Reasoning**

This reuses the history developers can already inspect, keeps local execution
outside hosted financial policy, and makes future spend decisions testable before
credentials or external provider calls are introduced.

**Trade-offs**

Advisory pricing is not a billing record, reporting remains per project, and the
current CLI has no hosted provider to enforce at runtime. Privacy and secret
blocks remain independent and stronger than any cost override.
