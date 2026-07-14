# Local usage and outcome logging

Friday records model-backed workflow metadata in a local append-only JSONL log so routing and cost decisions can be compared with real developer outcomes over time.

The log is stored under the project-owned runtime directory:

```text
.friday/runtime/execution-log.jsonl
```

Each line is a versioned JSON record. Schema version `1` captures:

- workflow type and optional Friday artefact path
- recommended route and chosen route
- chosen provider and model
- start and completion timestamps
- latency in milliseconds
- token usage and advisory cost estimates
- execution result status
- safe provider failure details such as error code and finish reason
- privacy level, blocked state, and whether a secret was detected
- optional developer outcome status: `accepted`, `retried`, `escalated`, or `rejected`

The log remains local. Friday does not upload, synchronise, or send it to an analytics service.

## Privacy defaults

Execution log records are metadata-only by default. They do not store raw prompts, model output text, detected secret values, API keys, or private content snippets. When a secret is detected, the log can record `secretDetected: true`, but not the matched secret itself.

The execution artefact may still contain provider output for an explicit local run. The usage log is intentionally narrower because its purpose is historical routing and outcome analysis, not replaying prompts.

Provider invocations that fail response validation are also recorded. These
records may include provider/model, timing, available token usage, finish reason,
and a stable error code such as `output-limit-exhausted`, `reasoning-only`, or
`empty-content`. They do not include the provider's raw response, hidden
reasoning, or the original prompt. A failed invocation does not create a normal
assistant-result artefact.

## Reading and summaries

The usage log helpers can append records, read them back in file order, and summarise local history. Run the read-only CLI command from a project root:

```bash
friday usage
friday usage --since 24h
friday usage --since 2026-07-01 --group-by workflow
friday usage --group-by model
```

`--since` accepts a positive duration using `m`, `h`, `d`, or `w`, or a date
that JavaScript can parse. Duration filters are relative to the current time and
records are selected by completion time. `--group-by workflow` or
`--group-by model` narrows the grouping section; the default includes both.

The summary reports:

- total record count
- successful, failed, and blocked attempt counts
- recorded input, output, and total token counts
- advisory cost totals by currency
- counts by workflow
- counts by provider/model
- retry and escalation counts
- counts for each developer outcome status

Malformed JSONL is rejected with a line-specific error so local history can be repaired without guessing which record failed.

A missing log is an empty history, not an error. The command never prints raw
prompts, model responses, secret values, or private snippets because those fields
are not part of the execution-log schema. Advisory cost is not a billing record;
local-model financial cost may correctly be zero.
