export function runHelpCommand(): void {
  const message = `Friday is a local-first AI development cockpit with project memory, privacy-aware context handling, model routing and cost control.

Usage:
  friday <command>

Available commands:
  init     Initialize Friday project memory in the current project
  status   Show Friday project memory status
  evidence Prepare local evidence files; use --collect [--timeout-ms N] to run deterministic providers
  plan     Create a planning prompt from local project memory
  review   Create a review prompt from local changed-file context
  execute  Execute an existing prompt artefact through an explicit local provider
  route    Preview Friday's model route for a task without calling a provider
  cost     Estimate advisory provider/model cost from token counts
  help     Show this help message

Planned commands:
  brainstorm
  spec
  design
  escalate
`

  console.log(message)
}
