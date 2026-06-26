export function runHelpCommand(): void {
  const message = `Friday is a local-first AI development cockpit with project memory, privacy-aware context handling, model routing and cost control.

Usage:
  friday <command>

Available commands:
  init     Initialize Friday project memory in the current project
  status   Show Friday project memory status
  help     Show this help message

Planned commands:
  brainstorm
  plan
  spec
  design
  review
  cost
  escalate
`

  console.log(message)
}
