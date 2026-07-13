import type { AiTaskType } from '../routing/modelRouting.js'

export const workflowOutputTokenDefaults = {
  plan: 4_000,
  review: 3_000,
  explicitTask: 2_000,
} as const

export function getDefaultMaxOutputTokens(taskType: AiTaskType): number {
  if (taskType === 'plan') {
    return workflowOutputTokenDefaults.plan
  }

  if (taskType === 'review') {
    return workflowOutputTokenDefaults.review
  }

  return workflowOutputTokenDefaults.explicitTask
}
