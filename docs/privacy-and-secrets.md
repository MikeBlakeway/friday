# Privacy and Secret Safety Gate

Friday includes a deterministic local safety gate for prompt and project context
before future hosted-model integrations are connected.

## Privacy levels

- `public`: generic technical or public information with no project, personal,
  sensitive, or secret signals.
- `internal`: project or product planning context that is not source code and
  does not contain sensitive or secret material.
- `private-repo`: repository code, stack traces, source-file paths, package
  metadata, or implementation details.
- `sensitive`: personal data, customer data, payroll, medical, credentials
  language, passwords, or production-database context.
- `secret`: detected secret values or file paths that are likely to contain
  secrets.

## Secret detection

The detector currently identifies common risky patterns:

- OpenAI-style `sk-...` keys
- GitHub classic, fine-grained, OAuth, user, server, and refresh tokens
- AWS access-key IDs beginning with `AKIA` or `ASIA`
- private-key block headers
- database URLs for PostgreSQL, MySQL, MongoDB, and Redis
- risky environment assignments such as `DATABASE_URL=...`, `API_KEY=...`,
  `SECRET=...`, `TOKEN=...`, `PASSWORD=...`, and `PRIVATE_KEY=...`
- `Authorization: Bearer ...` headers

Detected matches return kind, label, source index, length, and a redacted
preview. Full matched secret values are not returned.

## Blocking behavior

Secret content is always classified as `secret` and `blocked: true`. Files named
`.env`, `.env.local`, `.npmrc`, or `.netrc`, and paths containing `secrets`,
`credentials`, or `keys`, are treated as secret even when the prompt text does
not contain a detectable secret value.

## Current limits

This layer is deterministic and intentionally conservative. It is not a complete
data-loss-prevention system, and it can miss novel secret formats or classify
benign text conservatively. It does not call providers, load credentials, read
environment variables, or make network requests.

## Routing handoff

The classifier returns the same `PrivacyLevel` vocabulary used by the
model-routing domain. `composeAiRouteRecommendation` composes
`classifyPromptPrivacy` with `routeAiRequest` so raw task prompts can be routed,
warned, or blocked before any provider call is attempted.

Secret context cannot produce a hosted route. Sensitive context defaults to a
local route. The composed result includes the classification, the generated
`RouteAiRequestInput`, the route recommendation, and user-facing warnings.

## Execution handoff

`friday execute` uses the same classifier immediately before provider
invocation. It reads an existing generated prompt artefact, classifies the
current file contents, routes with hosted models disabled, and refuses to invoke
the local provider when the prompt is classified as `secret` or otherwise
blocked.

This keeps preparation and execution visibly separate: `plan` and `review`
create files for inspection, while `execute` is the only command that can call a
model provider. Execution writes a new JSON result artefact under
`.friday/output/executions/` and does not overwrite the source prompt.
