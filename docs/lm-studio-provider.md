# LM Studio Provider

Friday includes an optional LM Studio provider adapter for local text
generation. LM Studio can expose local models through an OpenAI-compatible HTTP
server, and Friday talks to that server only through the provider-neutral
`AiModelProvider` contract in `src/ai/providers/modelProvider.ts`.

The preparation CLI workflow commands still work without LM Studio installed or
running. `friday execute <prompt-path> --provider local` discovers LM Studio and
its loaded models before constructing the adapter. It fails before writing an
execution result if the service or a usable model is not available.

## Global Provider Configuration

Machine-specific provider settings are optional and live outside repositories
at `~/.friday/providers.json`. The current schema is versioned and deliberately
accepts only local endpoint, model, and process-start policy fields:

```json
{
  "schemaVersion": 1,
  "defaultProvider": "lm-studio",
  "providers": {
    "lm-studio": {
      "baseUrl": "http://127.0.0.1:1234/v1",
      "model": "qwen3-coder-14b",
      "autoStart": false
    }
  }
}
```

The file is not required. When it is missing, Friday discovers LM Studio at the
common endpoints `http://127.0.0.1:1234/v1` and
`http://localhost:1234/v1`.

Configuration is validated before discovery. Base URLs must use plain HTTP on
`localhost`, `127.0.0.1`, or `::1`; credential fields and arbitrary fields are
rejected. `autoStart` is reserved for future work and must remain `false` because
Friday never silently starts provider processes.

Provider configuration is separate from repository `.friday/` memory. Do not
commit machine-level `providers.json` into individual projects.

## Guided Setup

Run the one-time guided setup after installing LM Studio and loading a model:

```bash
friday local setup
```

The command:

1. detects whether the `lms` CLI is available;
2. queries the configured or common localhost `/v1/models` endpoints;
3. automatically selects one loaded model or presents multiple models in the
   order returned by LM Studio;
4. writes the provider, endpoint, selected model, and `autoStart: false` to
   `~/.friday/providers.json` while preserving other provider entries; and
5. offers a small generation request to verify the saved setup.

If `lms` is available but the server is stopped, Friday asks before running
`lms server start`. A declined prompt cancels without changing configuration.
The `--start-server` flag is the equivalent explicit authorization for an
unattended invocation; Friday never starts a process merely because
`autoStart` appears in configuration.

Non-interactive use requires all provider settings so model selection cannot
block waiting for input:

```bash
friday local setup \
  --provider lm-studio \
  --base-url http://127.0.0.1:1234/v1 \
  --model qwen3-coder-14b \
  --test
```

Omit `--test` to save a verified endpoint/model selection without sending a
generation request. Friday does not download or load models. Missing CLI,
unavailable server, no-model, invalid endpoint, unavailable model, start
failure, and test failure messages include the next corrective action.

## Discovery and Model Selection

Friday queries the OpenAI-compatible `/v1/models` endpoint and reads the loaded
model identifiers. Selection is deterministic:

1. Use `providers.lm-studio.model` when that identifier is loaded.
2. Automatically use the only loaded model when exactly one is available.
3. During `friday local setup`, when multiple models are loaded without a usable
   configured default, list them and ask the user to choose one. Other commands
   ask the user to run setup or set `providers.lm-studio.model`.
4. When the server has no loaded models, ask the user to load one and retry.

This removes the previous requirement to alias a model as `local-model`.

## Code-Level Configuration

Create the provider explicitly from code:

```ts
import { createLmStudioProvider } from './src/ai/providers/lmStudioProvider.js'

const provider = createLmStudioProvider({
  baseUrl: 'http://127.0.0.1:1234/v1',
  model: 'your-loaded-model-id',
})
```

For direct construction, pass the exact loaded model identifier. The normal CLI
path resolves this identifier through configuration and discovery. The adapter
does not download models, start LM Studio, read API keys, or send requests to
hosted providers. Process startup belongs only to the guided setup command and
requires prompt confirmation or the explicit `--start-server` flag.

## Availability

Call `checkAvailability()` before generation when a workflow wants a lightweight
readiness check:

```ts
const availability = await provider.checkAvailability()
```

The check calls the configured `/models` endpoint. It returns
`{ available: false, message }` instead of throwing when LM Studio is stopped,
unreachable, or returning a non-success HTTP status.

For an end-to-end support report, run `friday doctor`. It checks the Node.js
runtime, Friday build/install, project and global memory, provider configuration,
LM Studio endpoint, and loaded-model selection. It does not generate model output
unless `friday doctor --test-provider` is passed explicitly. Diagnostics never
download models, start servers, change configuration, or perform repairs.

The lightweight generation test starts with a 64-token output allowance. If the
provider reports output-limit exhaustion before returning final content, Friday
retries at 256 and then 1,024 tokens. This observed-behaviour policy supports
reasoning-capable models without relying on model-name guesses, while keeping
the retry count and maximum allowance bounded. Other failures, including a
reasoning-only response that stopped normally, are not retried because more
tokens would not reliably correct them.

## Generation

`generateResponse()` sends a minimal OpenAI-compatible
`/chat/completions` request with Friday's provider-neutral messages, model,
`maxOutputTokens`, and `temperature`.

Friday accepts standard non-empty assistant text and text-part arrays. When LM
Studio returns separate `reasoning_content` alongside final `message.content`,
Friday uses only the final assistant content. Hidden reasoning is never returned
as the assistant message, written to the execution artefact, or included in the
usage history.

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
- loads optional configuration from `~/.friday/providers.json`;
- discovers LM Studio and resolves a loaded model without relying on a fixed
  alias;
- re-runs privacy and secret classification for the prompt file;
- routes with hosted providers disabled;
- rejects blocked or secret-bearing content before invoking LM Studio;
- checks the local provider availability endpoint before generation;
- writes a successful assistant response, usage, route, safety result, and
  advisory local cost estimate to `.friday/output/executions/*.json`;
- records failed provider invocations in metadata-only
  `.friday/runtime/execution-log.jsonl` history without storing the prompt,
  hidden reasoning, secrets, or raw provider response.

Unavailable providers, blocked input, and malformed provider output fail without
modifying the source prompt artefact.

## Failure Behavior

Discovery and generation return or throw user-facing errors when:

- LM Studio is not reachable.
- No model is loaded, or multiple models require a configured choice.
- Global provider configuration is invalid or selects an unsupported provider.
- The configured endpoint returns a failed HTTP response.
- The endpoint returns invalid JSON.
- The response is missing choices, assistant message content, or valid token
  usage.
- A reasoning model consumes the output allowance before producing final
  content. The error reports `finish_reason: length`, provider/model, and
  available usage, and suggests increasing `--max-output-tokens` explicitly.
- A response contains separate reasoning but no final answer. Friday reports a
  reasoning-only diagnostic without exposing the reasoning text.
- A stopped response contains neither final content nor separate reasoning. The
  error includes provider/model, finish reason, and available usage so the model
  chat template or LM Studio reasoning-output settings can be corrected.
- The request asks for unsupported output or tool calls.

LM Studio can be configured to separate reasoning from final content. Supported
models must still produce non-empty final assistant content for Friday to treat
the execution as successful. If usage is omitted from an otherwise valid
response, Friday retains the result and records zero token counts rather than
discarding the final content.

Tests mock the HTTP layer, so Friday's normal validation does not require LM
Studio to be installed or running.
