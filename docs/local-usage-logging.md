# Local usage and outcome logging

Friday records model-backed workflow metadata in a local append-only JSONL log so routing and cost decisions can be compared with real developer outcomes over time.

Execution records are stored under the project-owned runtime directory:

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
- optional legacy developer outcome status from schema version `1`

The log remains local. Friday does not upload, synchronise, or send it to an analytics service.

## Recording developer outcomes

Provider execution status and developer outcome answer different questions. An
execution status of `succeeded` means the provider returned a valid result; it
does not mean the result was useful. Record that separate judgement explicitly:

```bash
friday outcome 4c10d5d5-2bd3-43f0-9d51-337e3ffcb977 accepted
friday outcome latest rejected
```

The supported structured values are `accepted`, `retried`, `escalated`, and
`rejected`. The first version deliberately accepts no free-text reason, prompt,
response, secret, or private snippet.

An exact execution identifier is required in non-interactive use. In an
interactive terminal, `latest` displays the selected execution's identifier,
workflow, provider/model, execution status, and completion time, then requires
confirmation before writing. Use an exact identifier when there is any doubt.
Duplicate execution identifiers are rejected as ambiguous rather than guessed.

Outcomes are appended as versioned structured events in a separate local file:

```text
.friday/runtime/outcome-log.jsonl
```

Recording another outcome for the same execution never edits or deletes the
earlier event. The newest event in file order is the effective outcome shown by
`friday usage`; the complete append-only history remains available for review.

## Privacy defaults

Execution records and outcome events are metadata-only by default. They do not store raw prompts, model output text, detected secret values, API keys, free-text reasons, or private content snippets. When a secret is detected, the execution log can record `secretDetected: true`, but not the matched secret itself.

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

Malformed execution or outcome JSONL is rejected with a line-specific error so local history can be repaired without guessing which record failed.

A missing log is an empty history, not an error. The command never prints raw
prompts, model responses, secret values, or private snippets because those fields
are not part of the execution-log schema. Advisory cost is not a billing record;
local-model financial cost may correctly be zero.
