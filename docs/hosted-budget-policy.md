# Hosted budget policy

Friday has a typed, local, aggregate-cost policy for a future hosted execution
boundary. It deliberately does not add hosted providers, API-key loading,
provider billing APIs, telemetry, or local CPU/GPU quotas.

The policy reads the existing project-owned execution history:

```text
.friday/runtime/execution-log.jsonl
```

Only records whose chosen route is hosted count toward hosted financial usage.
Local routes, including LM Studio records with zero configured financial cost, do
not consume or block a hosted budget.

## Configuration

Create either or both of these versioned JSON files deliberately:

```text
~/.friday/budget-policy.json
.friday/budget-policy.json
```

Example:

```json
{
  "schemaVersion": 1,
  "period": "calendar-month",
  "currency": "USD",
  "aggregateHostedCost": {
    "warningThreshold": 10,
    "hardLimit": 15,
    "allowHardLimitOverride": false
  }
}
```

`warningThreshold` and `hardLimit` are non-negative advisory-cost amounts. A
warning must not exceed its hard limit. Configurations with another schema
version, invalid JSON, mixed currencies, or invalid thresholds fail before a
future hosted invocation and state how to repair the policy.

## Precedence and safety

The global policy is a ceiling, not a default a project can silently relax.
When both files exist, Friday takes the lower configured warning threshold and
hard limit. If a warning inherited from either layer would exceed the stricter
hard limit, Friday clamps the effective warning to that hard limit. This keeps
two individually valid policies deterministic while never weakening either
ceiling. Both policies must use the same currency and period. A hard-limit
override is allowed only when every policy defining a hard limit explicitly
permits it; omitting that flag is restrictive.

The evaluator returns a versioned result with the current calendar-month hosted
usage, estimated request cost, projected usage, remaining hard-limit allowance,
status (`within`, `warning`, or `blocked`), source, and explicit reasons. Cost
is advisory because Friday pricing estimates are not provider billing records.

A warning requires explicit acknowledgement. A hard-limit breach blocks unless
the effective policy permits and receives an explicit override. Those actions
are represented as versioned, metadata-only execution-log fields; they never
store a prompt, response, secret, or free-text rationale. Privacy and secret
blocks run independently and cannot be overridden by cost acknowledgement or a
hard-limit override.

## Reporting

Use the read-only current-project view:

```bash
friday usage --budget
```

It reports the applicable policy source, calendar period, hosted usage,
remaining allowance, policy state, and reasons. `--budget` always uses the
current UTC calendar month, so it rejects `--since` and `--group-by` rather than
silently ignoring them. A missing policy has an `unconfigured` status with
actionable guidance; a future hosted preflight will refuse invocation until one
is configured. If projected usage exceeds a hard limit, remaining allowance is
shown as zero and the excess is reported separately as overage. The current CLI
still executes only local LM Studio providers; the hosted preflight contract will
be used before any future external invocation.
