export function runHelpCommand(): void {
  const message = `Friday is a local-first AI development cockpit with project memory, privacy-aware context handling, model routing and cost control.

Usage:
  friday <command>

Start here:
  friday local setup
  friday global init
  friday doctor
  friday init
  friday evidence --collect
  friday run plan "Recommend the next useful improvement"

Setup:
  local setup  Configure a reusable local provider and model
  global init  Prepare optional reusable developer memory
  init         Initialize project memory in the current project

Preparation and inspection (no model call):
  status       Show project memory status
  evidence     Prepare evidence; add --collect to run deterministic providers
  plan         Create a planning prompt artefact from project memory
  review       Create a review prompt artefact from changed-file context

Execution:
  run          Prepare and execute a plan or review with the configured local provider
  execute      Execute an existing prompt artefact through an explicit local provider
               Limit response display with --display-max-lines / --display-max-chars

Diagnostics:
  doctor       Check installation, memory, provider and model readiness
               Add --test-provider to send a lightweight local test request

Advanced policy tools:
  route        Preview a model route without calling a provider
  cost         Estimate advisory provider/model cost from token counts

Help:
  help         Show this help message

Planned commands:
  brainstorm
  spec
  design
  escalate
`

  console.log(message)
}
