# Architecture

## Overview

Friday is a local, CLI-first TypeScript application. Its current architecture keeps
project memory, deterministic evidence, prompt construction, command handling,
privacy classification, route policy, cost estimation, and provider contracts
separate so model execution does not couple provider behavior
to file-system concerns.

Per-project memory lives in `.friday/` beside the source repository. The CLI reads
that memory, builds structured planning and review prompts, writes generated
artefacts back to `.friday/output/`, and prints local AI policy summaries for
route and cost decisions. Explicit local LM Studio execution is implemented;
hosted provider execution is not.

## Current Modules

- **CLI commands** — dispatch command-line workflows. Implemented commands are
  `friday init`, `friday status`, `friday evidence`, `friday plan`,
  `friday review`, `friday route`, `friday cost`, `friday doctor`,
  `friday local setup`, `friday run`, and `friday execute`.
- **Core project memory** — defines the `.friday/` file set, creates templates,
  checks project status, and loads existing memory files.
- **File-system helpers** — provide small async operations for checking paths and
  reading or writing local files.
- **Evidence providers foundation** — defines typed evidence summaries, known
  evidence-file names, local templates, placeholder filtering, and evidence-pack
  aggregation. Manual Markdown evidence parsing and opt-in Git, TypeScript, test,
  and Fallow collection are implemented.
- **Planning prompt builder** — combines a goal, non-empty project memory, and
  available evidence into a provider-neutral Markdown prompt, then summarizes
  privacy, route, and advisory cost policy for the generated prompt.
- **Review prompt builder** — combines local changed-file context, project
  memory, and evidence into a provider-neutral Markdown review prompt, then
  summarizes privacy, route, and advisory cost policy for the generated prompt.
- **Privacy and secret safety** — classifies prompt context as public, internal,
  private-repo, sensitive, or secret and redacts common secret matches.
- **Model routing** — recommends blocked, local, cheap hosted, strong hosted, or
  premium routes from task, privacy, complexity, confidence, and cost inputs.
- **Cost estimation** — estimates advisory input, output, and total model cost
  from configured per-million token prices and estimated token counts.
- **Provider contracts** — define provider-neutral model request, response,
  usage, capability, and mock-provider interfaces, plus validated global
  configuration, LM Studio discovery, guided setup, and explicit local execution.
- **Generated output** — stores planning prompts under
  `.friday/output/plan-prompt.md` and review prompts under
  `.friday/output/review-prompt.md` so they are inspectable before any model use.

## Data Flow: `friday run plan|review`

1. The existing plan or changed-file review workflow writes its normal prompt
   artefact.
2. The shared execution preflight re-runs privacy classification, secret
   blocking, local routing, provider availability, and advisory cost estimation.
3. Friday prints the selected local provider/model and expected output location,
   then requires interactive confirmation or the explicit `--yes` flag.
4. The existing local execution path invokes the provider and writes the normal
   result artefact and metadata-only usage log.

## Data Flow: `friday plan`

1. The CLI receives `friday plan <goal...>` from the current repository root.
2. The command verifies that `.friday/` exists and reads optional manual evidence
   from `.friday/evidence/manual.md` when present.
3. The project-memory loader reads the six expected `.friday/*.md` files and keeps
   missing files explicit rather than failing the workflow.
4. The planning prompt builder includes the goal, non-empty memory files, and
   parsed evidence in a structured Markdown prompt.
5. The command writes the result to `.friday/output/plan-prompt.md` and reports
   the loaded memory files, evidence count, privacy classification, route
   recommendation, and advisory cost estimate.
6. A developer can review or paste that prompt into a chosen model. Friday makes
   no model request at this stage.

## Data Flow: `friday review --changed`

1. The CLI verifies that `.friday/` exists.
2. The command reads `git diff HEAD --` and untracked files from the current
   repository.
3. The command loads project memory and optional manual evidence.
4. The review prompt builder formats changed-file diffs, memory, and evidence
   into `.friday/output/review-prompt.md`.
5. The command reports the loaded context, privacy classification, route
   recommendation, and advisory cost estimate.
6. A developer can inspect the generated prompt before deciding whether to share
   it with a model.

## Data Flow: `friday route`

1. The CLI parses explicit task, privacy, complexity, confidence, cost, hosted,
   and premium flags.
2. The routing policy returns the recommended route, warnings, and alternatives.
3. The command prints the decision without reading project files or calling a
   provider.

## Data Flow: `friday cost`

1. The CLI parses provider, model, input-token, and output-token estimates.
2. The command looks up built-in advisory pricing for the provider/model pair.
3. The cost estimator returns deterministic input, output, and total cost
   estimates with an advisory warning.
4. The command prints the estimate without reading provider credentials, logging
   real usage, or calling a provider.

## Important Boundaries

- **Project memory versus generated output:** source memory is human-maintained;
  generated prompts are derived artefacts under `.friday/output/`.
- **Deterministic evidence versus LLM reasoning:** evidence collection and parsing
  should establish facts before an LLM is asked to interpret them.
- **Core workflow versus AI providers:** planning and review currently produce
  neutral prompts plus local route and cost summaries, preserving provider choice
  and avoiding provider lock-in.
- **Convenience versus inspectability:** `friday run` coordinates preparation and
  execution but does not bypass prompt artefacts, safety policy, local-only
  routing, or approval.
- **Local context versus hosted services:** routing and privacy logic exists, but
  future provider execution must apply those gates before any context is sent
  outside the developer environment.
- **Global versus project memory:** optional reusable developer preferences live
  under `~/.friday/`; repository context lives under `.friday/`. Machine-level
  provider configuration is global configuration, not prompt memory.

## Future Architecture Areas

- Add hosted provider implementations behind the existing interfaces and safety
  gates; local LM Studio execution is already implemented.
- Add budget policy and aggregate cost reporting on top of existing local usage
  logging.
- Add repeatable brainstorming, specification, refactoring, and escalation
  workflows built on the same core memory and evidence boundaries.
