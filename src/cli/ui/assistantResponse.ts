import {
  assistantDisplayDefaults,
  formatAssistantResponseForDisplay,
  type AssistantDisplayPolicy,
  type FormattedAssistantResponse,
} from '../../ai/execution/outputTokenPolicy.js'

export function printAssistantResponse(input: {
  content: string
  resultArtifact: string
  policy?: AssistantDisplayPolicy
}): FormattedAssistantResponse {
  const displayed = formatAssistantResponseForDisplay(
    input.content,
    input.policy ?? assistantDisplayDefaults,
  )

  console.log('Assistant response:')
  console.log(displayed.content)

  if (displayed.redactedSecretCount > 0) {
    console.log('')
    console.log(
      `[Friday redacted ${displayed.redactedSecretCount} likely secret${displayed.redactedSecretCount === 1 ? '' : 's'} from CLI display. The full local response remains in the execution artefact.]`,
    )
  }

  if (displayed.truncated) {
    console.log('')
    console.log(
      `[Friday truncated CLI display at ${displayed.policy.maxLines} lines or ${displayed.policy.maxChars} characters. Full response: ${input.resultArtifact}]`,
    )
  }

  return displayed
}
