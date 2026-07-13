# First run with a local model

This walkthrough is the end-to-end path from an installed Friday CLI to a
completed local-model workflow. It uses the terms shown by the CLI:

- **local provider**: LM Studio's localhost server;
- **model**: the loaded model selected during setup;
- **project memory**: repository-owned Markdown under `.friday/`;
- **global memory**: optional reusable Markdown under `~/.friday/`;
- **prompt artefact**: the inspectable input Friday prepares before execution;
- **result artefact**: the JSON record containing the local model response; and
- **usage history**: metadata-only execution records kept in the project.

## Install

Friday requires Node.js 18 or newer. Install the current release tarball:

```bash
npm install -g ./friday-0.1.0.tgz
friday help
```

For local development from this repository:

```bash
npm install
npm run link:local
friday help
```

The link points at the current checkout and persists across rebuilds. During
development, `npm run dev:linked` performs the initial build/link and watches
TypeScript files so the global `friday` command stays current as code changes.

Friday is not currently published to npm. `npm install -g friday` describes the
future registry path, not an implemented installation option.

## Set up the local provider

Install and launch LM Studio, load a model, and enable its local server. Setup is
a one-time machine-level step:

```console
$ friday local setup
Friday local model setup

✓ LM Studio CLI detected
✓ Local server found at http://127.0.0.1:1234/v1
✓ 1 loaded model found
✓ Default model selected: qwen3-coder-14b
✓ Configuration saved to ~/.friday/providers.json
✓ Test request completed successfully
Friday is ready to use local models.
```

Model identifiers vary by machine. Setup never downloads or loads a model and
never silently starts a process.

## Prepare optional global memory

Global memory lets Friday reuse developer preferences and policies across
repositories. The interactive command lets you select minimal defaults and
previews the exact content before asking for final confirmation:

```bash
friday global init
```

Existing `~/.friday/*.md` files are always preserved. In a non-interactive
environment, use `friday global init --minimal --yes` to create every missing
minimal file explicitly. This command makes no model calls and does not change
provider configuration.

## Verify the machine

Run doctor after provider setup and any optional global-memory preparation:

```console
$ friday doctor
Friday diagnostics

Project
! .friday project memory not found
  Action: Run "friday init" in this project to create local project memory.

Global configuration
✓ Global memory is readable and complete
✓ Provider configuration loaded; default local provider: lm-studio

Local provider
✓ LM Studio server reachable at http://127.0.0.1:1234/v1
✓ Model selected: qwen3-coder-14b
○ Test generation skipped

Friday is ready for local execution.
```

Run `friday doctor --test-provider` when you want diagnostics to send a
lightweight local generation request.

## Initialise and inspect a project

From a project root:

```console
$ friday init
Project root: /path/to/project
Friday memory directory: /path/to/project/.friday

Created files:
  + .friday/project.md
  + .friday/architecture.md
  + .friday/decisions.md
  + .friday/design.md
  + .friday/tasks.md
  + .friday/notes.md

Next steps:
  1. Fill in the new .friday memory files.
  2. Run "friday evidence --collect".
  3. Run "friday run plan \"Recommend the next useful improvement\"".
```

Edit the memory files with enough truthful project context to guide the model,
then collect deterministic evidence:

```console
$ friday evidence --collect
Friday evidence prepared.
Evidence pack: .friday/evidence/evidence-pack.json
```

Collection records Git, TypeScript, test, and Fallow output where the project
supports them. It preserves human-authored evidence and records command failures
as evidence instead of presenting them as successful checks.

## Run planning and review

Planning prepares an inspectable prompt, prints a privacy/routing/cost preflight,
asks for approval, and then calls the configured local provider:

```console
$ friday run plan "Recommend the next useful improvement"
Friday planning prompt created.

Friday run pre-execution summary
Workflow: plan
Privacy level: private-repo
Route: use-local
Provider/model: lm-studio/qwen3-coder-14b
Expected output: .friday/output/executions/
Estimated cost: 0.000000 USD
Warnings:
- Private repository context requires local execution.
Execute this workflow with the configured local provider? [y/N] y

Friday workflow executed locally.
Prompt artefact: .friday/output/plan-prompt.md
Result artefact: .friday/output/executions/plan-prompt-2026-07-10T12-00-00-000Z.json
Usage: 1834 total tokens
```

The transcript is shortened around the preparation detail. The exact privacy
label, route decision, warning, token count, and file timestamp depend on the
project and run. Review changed files through the same execution path:

```bash
friday run review --changed
```

For inspect-first workflows, `friday plan` and `friday review --changed` stop
after creating prompt artefacts. `friday execute <prompt-path> --provider local`
executes an existing prompt artefact as a separate deliberate step.

## Inspect generated artefacts and usage history

```console
$ find .friday/output -maxdepth 2 -type f
.friday/output/plan-prompt.md
.friday/output/executions/plan-prompt-2026-07-10T12-00-00-000Z.json

$ tail -n 1 .friday/runtime/execution-log.jsonl
{"schemaVersion":1,"workflow":"plan","provider":"lm-studio","model":"qwen3-coder-14b","resultStatus":"succeeded"}
```

The abbreviated JSONL line above highlights the stable fields; real records also
contain timestamps, latency, routing, privacy, token, and advisory cost metadata.
Usage history never stores raw prompts, model output, secret values, or API keys.

## Dogfood Friday on Friday

This repository already contains curated `.friday/` project memory, so after the
one-time local setup the complete dogfooding path is:

```bash
git clone https://github.com/MikeBlakeway/friday.git
cd friday
npm install
npm run link:local
friday global init
friday doctor
friday evidence --collect
friday run plan "Review Friday and recommend the next smallest high-value improvement"
friday run review --changed
```

Inspect `.friday/output/plan-prompt.md`, the JSON result under
`.friday/output/executions/`, and `.friday/runtime/execution-log.jsonl` before
accepting the model's recommendation.

## Recovery commands

| Problem                                                         | Next command                    |
| --------------------------------------------------------------- | ------------------------------- |
| `.friday/` is missing or partial                                | `friday init`                   |
| Optional global memory is missing or partial                    | `friday global init`            |
| Provider configuration is missing or the selected model changed | `friday local setup`            |
| Readiness is unclear                                            | `friday doctor`                 |
| Local generation needs verification                             | `friday doctor --test-provider` |
| Evidence files need refreshing                                  | `friday evidence --collect`     |
| A non-interactive run needs explicit approval                   | Re-run with `--yes`             |

Global memory is optional. If it is missing, project workflows still work;
`friday global init` prepares only the `~/.friday/*.md` files you select and
preserves any existing content.

## Verification

The help layout, setup and doctor argument paths, project initialisation,
evidence collection, and plan/review run orchestration are covered by automated
tests. Before merging documentation changes, run:

```bash
npm run check
```

Provider HTTP calls use deterministic local-provider test doubles in the test
suite, so verification does not require downloading a model or contacting a
hosted service.
