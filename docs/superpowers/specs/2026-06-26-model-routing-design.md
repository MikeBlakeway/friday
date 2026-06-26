# Model Routing Domain Layer Design

## Goal

Add a pure, deterministic TypeScript policy that recommends an AI model route from
task, privacy, complexity, confidence, cost preference, and model-permission input.
It must not call a provider or introduce provider configuration.

## Scope

Create a `src/ai/routing/` domain module containing the routing types, the routing
policy, and Vitest coverage. Lightly update the README and Friday task/decision
memory to accurately describe the new recommendation-only capability.

Out of scope: provider SDKs, API keys, network requests, provider classes, routing
CLI commands, autonomous agents, and runtime model execution.

## Architecture

`modelRouting.ts` owns the provider-neutral vocabulary: task and policy inputs,
provider/model/tier values, route decisions, routes, and results. `routeAiRequest.ts`
owns the policy. It accepts a `RouteAiRequestInput` and returns a
`RouteAiRequestResult` without reading files, environment variables, or time.

The policy will use small route-construction helpers to keep the decision order
obvious. Privacy and safety gates take precedence over all cost or quality choices:

1. Secret context returns a blocked route with no alternatives.
2. Disabled hosted models and sensitive context return local routes.
3. Explicit escalation, or high-complexity/high-confidence quality-first work,
   selects premium only when permitted.
4. Low-complexity draft work and minimise-cost safe work prefer cheap hosted.
5. Planning, specification, review, refactor, and build work default to strong
   hosted; other hosted-safe defaults use strong hosted when cost does not justify a
   cheaper route.

For hosted-safe work that is neither low-complexity draft work nor a planning,
specification, review, refactor, or build task, the fallback is explicit:
`minimise-cost` selects cheap hosted, while `balanced` and `quality-first` select
strong hosted. The quality-first fallback may still be superseded by the permitted
premium-escalation rules.

The function returns user-facing reasons and warnings. Alternatives will be
deterministic and only expose routes that are meaningful under the selected policy:
cheap routes can offer strong hosted; strong routes can offer cheap hosted and
permitted premium; local and blocked routes expose no hosted alternatives.

## Testing

Vitest tests will use a typed default fixture plus narrow overrides. Coverage will
verify secret blocking, local-only routes, cheap and strong hosted routes, premium
permission behavior, escalation behavior, minimise-cost behavior, warnings, and
the empty alternatives invariant for blocked routes. They will include a
medium-complexity `ask` task with balanced cost preference selecting strong hosted,
and a low-complexity `design` task with minimise-cost selecting cheap hosted.

Tests will be written first and observed failing before the policy implementation.
The completed change will run `npm run typecheck`, `npm run test`, `npm run build`,
and `npm run check`.

## Documentation and Project Memory

The README will state that the routing layer recommends a route only; provider
integrations and model calls remain planned. `.friday/tasks.md` will record the
completed routing type/policy work and make privacy classification or policy
refinement the next active task. `.friday/decisions.md` will capture the decision to
build a pure policy layer before provider integrations.

## Trade-offs

This first layer is advisory rather than enforced at a provider boundary. That
keeps it simple, provider-agnostic, and fully testable while retaining a clear
future integration point for privacy enforcement, cost estimation, and model calls.
