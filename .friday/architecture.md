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
