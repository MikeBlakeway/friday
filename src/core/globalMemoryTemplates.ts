import type { FridayGlobalFile } from './globalMemory.js'

const PROFILE_TEMPLATE = `# Developer Profile

Prefer small, reviewable changes, practical explanations, and explicit validation.
`

const CODING_STANDARDS_TEMPLATE = `# Coding Standards

- Prefer strict types and clear names.
- Add focused tests for changed behaviour.
- Run the repository quality gate before shipping.
`

const PRIVACY_POLICY_TEMPLATE = `# Privacy Policy

- Keep private repository context local by default.
- Never include or expose authentication values, access tokens, or API keys.
- Require explicit approval before using hosted providers.
`

const MODEL_POLICY_TEMPLATE = `# Model Policy

- Prefer configured local models.
- Keep provider and model selection explicit and inspectable.
- Use reasoning-capable models when task complexity benefits from them.
`

const COST_POLICY_TEMPLATE = `# Cost Policy

- Treat cost estimates as advisory.
- Prefer local execution when suitable.
- Require approval before incurring hosted-provider costs.
`

export function getGlobalMemoryTemplate(fileName: FridayGlobalFile): string {
  switch (fileName) {
    case 'profile.md':
      return PROFILE_TEMPLATE
    case 'coding-standards.md':
      return CODING_STANDARDS_TEMPLATE
    case 'privacy-policy.md':
      return PRIVACY_POLICY_TEMPLATE
    case 'model-policy.md':
      return MODEL_POLICY_TEMPLATE
    case 'cost-policy.md':
      return COST_POLICY_TEMPLATE
  }
}
