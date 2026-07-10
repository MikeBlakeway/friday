# LM Studio Provider

Friday includes an optional LM Studio provider adapter for local text
generation. LM Studio can expose local models through an OpenAI-compatible HTTP
server, and Friday talks to that server only through the provider-neutral
`AiModelProvider` contract in `src/ai/providers/modelProvider.ts`.

The existing CLI workflow commands still work without LM Studio installed or
running. They do not construct this adapter automatically.

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
