# Privacy Classification and Secret Detection Design

## Goal

Add a deterministic, local safety gate that classifies prompt/context privacy and
detects likely secrets before Friday later introduces hosted-model calls.

## Scope

The feature is a pure TypeScript domain layer. It does not load credentials,
call providers, make network requests, add CLI commands, or change routing
behaviour.

## Architecture

`src/ai/privacy/privacyClassification.ts` will define the public contracts and
reuse `PrivacyLevel` from `src/ai/routing/modelRouting.ts`. It will expose the
secret match, classification signal, input, and result types without creating a
second privacy vocabulary.

`src/ai/privacy/detectSecrets.ts` will contain readable, deterministic patterns
for common API keys, GitHub tokens, AWS access-key IDs, private-key block
headers, database URLs, risky environment assignments, and Bearer auth headers.
It will return every match with a kind, source index, length, label, and a
redacted preview. It must never return the raw matched value.

`src/ai/privacy/classifyPromptPrivacy.ts` will compose secret detection with
path and content hints. It will return a classification, user-facing signals,
block state, and reason. This is the future handoff point to model routing; no
connection is made in this change.

## Classification Policy

Classification applies the following precedence and never lets a weaker signal
downgrade a stronger one:

1. Any detected secret returns `secret`, `blocked: true`, and a high-severity
   `secret-detected` signal. The reason states that hosted-model use must be
   blocked.
2. Sensitive path or content hints return `sensitive` unless a secret is found.
3. Code-like content and source-file context return `private-repo` unless a
   stronger classification is present.
4. Non-code project planning returns `internal`.
5. Generic text with no signal returns `public`.

An explicitly declared privacy level acts as a minimum baseline when no secret
is found. The classifier may raise, but never lower, that level.

Files named `.env`, `.env.local`, `.npmrc`, or `.netrc`, and paths containing
`secrets`, `credentials`, or `keys`, are treated as `secret` and therefore
blocked. This intentionally conservative choice prevents future accidental
hosted-model disclosure.

## Redaction and Error Handling

`redactSecret` will return eight asterisks for values of eight characters or
fewer. Longer values retain only the first and last four characters with a
fixed redacted middle. Secret previews and reasons must not contain full secret
values. Detection and classification are total, synchronous functions over
strings; no external errors, I/O, or mutable state are involved.

## Tests

Vitest tests will prove each supported secret pattern, multiple-match handling,
safe text, and the redaction guarantee. Classification tests will cover secret
blocking, secret file paths, declared-level preservation, content/path signals,
precedence, and useful signals/reasons.

## Documentation

The README and a concise privacy document will describe the deterministic,
advisory safety gate, its privacy levels and current limitations, and its future
relationship to model routing. Friday project memory will mark this foundation
complete and identify cost estimation or privacy-routing composition as the next
step. A decision record will capture why this work precedes provider
integrations.

## Acceptance Criteria

- The layer has no runtime dependencies and no provider-facing behaviour.
- Existing `PrivacyLevel` is the only privacy-level type used.
- Secret previews do not reveal full secret values.
- Secret context is always blocked.
- `npm run typecheck`, `npm run test`, `npm run build`, and `npm run check` pass.
