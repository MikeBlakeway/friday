# Notes

- Avoid overbuilding. Prove the local workflow engine with small, useful commands
  before adding a GUI, voice, autonomous coding, or broad provider support.
- Prefer cheap and local models first in future routing, subject to task capability,
  privacy policy, and explicit developer choice.
- Never send secrets, credentials, tokens, or sensitive context to hosted models.
  Future hosted requests must pass privacy classification and secret-detection
  checks first.
- Prioritise strongly typed TypeScript, small modules, explicit interfaces, and
  testable boundaries.
- Gather deterministic evidence before asking an LLM to reason. Fallow, Git,
  TypeScript, and test results should inform later workflows as evidence, not be
  conflated with AI-provider output.
- Friday must remain useful before model integrations exist. Local memory,
  structured prompts, evidence, and inspectable output are valuable on their own.
- Routing, privacy classification, secret detection, provider contracts, advisory
  cost estimation, `friday cost`, and opt-in local evidence collection are
  implemented. Do not claim real provider execution, API-key loading, usage
  telemetry, or budget enforcement until those code paths exist.
- Keep generated artefacts under `.friday/output/` distinct from the human-curated
  project memory files.
