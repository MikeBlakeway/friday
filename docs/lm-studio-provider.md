# LM Studio Provider

Friday includes an optional LM Studio provider adapter for local text
generation. LM Studio can expose local models through an OpenAI-compatible HTTP
server, and Friday talks to that server only through the provider-neutral
`AiModelProvider` contract in `src/ai/providers/modelProvider.ts`.

The preparation CLI workflow commands still work without LM Studio installed or
running. `friday execute <prompt-path> --provider local` constructs this adapter
explicitly and fails before writing an execution result if LM Studio is not
available.

## Configuration

Create the provider explicitly from code:

```ts
import { createLmStudioProvider } from './src/ai/providers/lmStudioProvider.js'

const provider = createLmStudioProvider({
  baseUrl: 'http://127.0.0.1:1234/v1',
  model: 'your-loaded-model-id',
})
```

Defaults are intentionally local:

- `baseUrl`: `http://127.0.0.1:1234/v1`
- `model`: `local-model`

Use the exact model identifier shown by LM Studio for best results. The adapter
does not download models, start LM Studio, read API keys, or send requests to
hosted providers.

## Availability

Call `checkAvailability()` before generation when a workflow wants a lightweight
readiness check:

```ts
const availability = await provider.checkAvailability()
```

The check calls the configured `/models` endpoint. It returns
`{ available: false, message }` instead of throwing when LM Studio is stopped,
unreachable, or returning a non-success HTTP status.

## Generation

`generateResponse()` sends a minimal OpenAI-compatible
`/chat/completions` request with Friday's provider-neutral messages, model,
`maxOutputTokens`, and `temperature`.

The first supported path is local text generation. Tool calls, streaming, and
JSON-mode output are deliberately rejected with clear errors until Friday has a
workflow that needs them.

## CLI Execution Boundary

`friday plan` and `friday review` prepare inspectable prompt artefacts only. They
do not call LM Studio.

To execute a prompt, run a separate command:

```bash
friday execute .friday/output/plan-prompt.md --provider local
```

The execute command:

- requires the explicit `--provider local` flag;
- re-runs privacy and secret classification for the prompt file;
- routes with hosted providers disabled;
- rejects blocked or secret-bearing content before invoking LM Studio;
- checks the local provider availability endpoint before generation;
- writes the assistant response, usage, route, safety result, and advisory local
  cost estimate to `.friday/output/executions/*.json`.

Unavailable providers, blocked input, and malformed provider output fail without
modifying the source prompt artefact.

## Failure Behavior

Generation throws `LmStudioProviderError` with user-facing messages when:

- LM Studio is not reachable.
- The configured endpoint returns a failed HTTP response.
- The endpoint returns invalid JSON.
- The response is missing choices, assistant message content, finish reason, or
  valid token usage.
- The request asks for unsupported output or tool calls.

Tests mock the HTTP layer, so Friday's normal validation does not require LM
Studio to be installed or running.
