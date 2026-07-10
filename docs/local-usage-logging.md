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
- privacy level, blocked state, and whether a secret was detected
- optional developer outcome status: `accepted`, `retried`, `escalated`, or `rejected`

The log remains local. Friday does not upload, synchronise, or send it to an analytics service.

## Privacy defaults

Execution log records are metadata-only by default. They do not store raw prompts, model output text, detected secret values, API keys, or private content snippets. When a secret is detected, the log can record `secretDetected: true`, but not the matched secret itself.

The execution artefact may still contain provider output for an explicit local run. The usage log is intentionally narrower because its purpose is historical routing and outcome analysis, not replaying prompts.

## Reading and summaries

The usage log helpers can append records, read them back in file order, and summarise local history. The basic summary reports:

- total record count
- counts by workflow
- counts by provider/model
- counts by execution result status
- retry and escalation counts
- counts for each developer outcome status

Malformed JSONL is rejected with a line-specific error so local history can be repaired without guessing which record failed.
