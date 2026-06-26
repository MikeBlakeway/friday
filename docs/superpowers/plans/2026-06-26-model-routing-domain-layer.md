# Model Routing Domain Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and test a pure TypeScript policy that recommends a privacy-safe, cost-aware AI model route without invoking a provider.

**Architecture:** `modelRouting.ts` will define the provider-neutral routing vocabulary. `routeAiRequest.ts` will apply an ordered policy: privacy/permission gates, premium escalation, cheap draft/cost routes, task-specific strong routes, then explicit hosted-safe fallbacks. It returns route metadata, deterministic alternatives, and user-facing warnings with no I/O.

**Tech Stack:** TypeScript 6, NodeNext modules, Vitest 4, Prettier, Fallow.

---

### Task 1: Define the routing domain contract

**Files:**
- Create: `src/ai/routing/modelRouting.ts`

- [ ] **Step 1: Add the domain types that the policy tests will import**

```ts
export type AiTaskType =
  | 'brainstorm'
  | 'plan'
  | 'spec'
  | 'design'
  | 'build'
  | 'review'
  | 'refactor'
  | 'test'
  | 'ship'
  | 'ask'
  | 'escalate'

export interface RouteAiRequestInput {
  taskType: AiTaskType
  privacyLevel: PrivacyLevel
  complexity: TaskComplexity
  confidenceRequirement: ConfidenceRequirement
  costPreference: CostPreference
  allowHostedModels: boolean
  allowPremiumModels: boolean
}
```

- [ ] **Step 2: Complete the exported provider, tier, route, and result types**

```ts
export interface AiRoute {
  decision: RouteDecision
  provider: ModelProvider
  modelTier: ModelTier
  model: RecommendedModel
  reason: string
  requiresApproval: boolean
  blocked: boolean
}

export interface RouteAiRequestResult {
  route: AiRoute
  alternatives: AiRoute[]
  warnings: string[]
}
```

- [ ] **Step 3: Run the type checker**

Run: `npm run typecheck`

Expected: PASS; type declarations compile without emitting files.

- [ ] **Step 4: Commit the contract**

```bash
git add src/ai/routing/modelRouting.ts
git commit -m "feat(routing): add model routing domain types"
```

### Task 2: Specify route policy behavior with failing tests

**Files:**
- Create: `src/ai/routing/routeAiRequest.test.ts`
- Test: `src/ai/routing/routeAiRequest.test.ts`

- [ ] **Step 1: Create a typed fixture and the required policy tests**

```ts
import { describe, expect, it } from 'vitest'

import type { RouteAiRequestInput } from './modelRouting.js'
import { routeAiRequest } from './routeAiRequest.js'

function createInput(
  overrides: Partial<RouteAiRequestInput> = {},
): RouteAiRequestInput {
  return {
    taskType: 'ask',
    privacyLevel: 'public',
    complexity: 'medium',
    confidenceRequirement: 'standard',
    costPreference: 'balanced',
    allowHostedModels: true,
    allowPremiumModels: false,
    ...overrides,
  }
}
```

Add focused tests for secret blocking; hosted-disabled and sensitive local routes;
cheap draft routing; strong plan and review routing; permitted and denied premium
routing; permitted and denied escalation; minimise-cost behavior; blocked empty
alternatives; medium `ask` plus balanced selecting strong hosted; and low-complexity
`design` plus minimise-cost selecting cheap hosted. Assert decisions, providers,
models, flags, warnings, and alternatives where each behavior requires them.

- [ ] **Step 2: Run the new tests and confirm they fail because the module does not exist**

Run: `npm run test -- src/ai/routing/routeAiRequest.test.ts`

Expected: FAIL with a module-not-found error for `./routeAiRequest.js`.

- [ ] **Step 3: Commit the failing behavioral specification**

```bash
git add src/ai/routing/routeAiRequest.test.ts
git commit -m "test(routing): specify route recommendation policy"
```

### Task 3: Implement the pure routing policy

**Files:**
- Create: `src/ai/routing/routeAiRequest.ts`
- Test: `src/ai/routing/routeAiRequest.test.ts`

- [ ] **Step 1: Add route-construction helpers for blocked, local, cheap hosted, strong hosted, and premium routes**

```ts
function createRoute(
  decision: RouteDecision,
  provider: ModelProvider,
  modelTier: ModelTier,
  model: RecommendedModel,
  reason: string,
  requiresApproval = false,
  blocked = false,
): AiRoute {
  return { decision, provider, modelTier, model, reason, requiresApproval, blocked }
}
```

- [ ] **Step 2: Implement gate ordering and premium selection**

```ts
if (input.privacyLevel === 'secret') {
  return { route: blockedRoute, alternatives: [], warnings: [secretWarning] }
}

if (!input.allowHostedModels || input.privacyLevel === 'sensitive') {
  return localResult(input)
}

if (input.taskType === 'escalate' || shouldEscalateToPremium(input)) {
  return premiumResultOrStrongFallback(input)
}
```

`shouldEscalateToPremium` must require high complexity, high confidence, and
quality-first cost preference. The strong fallback must warn when premium is
requested or normally indicated but not permitted.

- [ ] **Step 3: Implement hosted-safe defaults and alternatives**

```ts
if (input.complexity === 'low' && input.confidenceRequirement === 'draft') {
  return cheapHostedResult()
}

if (input.costPreference === 'minimise-cost') {
  return cheapHostedResult()
}

if (isStrongTask(input.taskType)) {
  return strongHostedResult(input.allowPremiumModels)
}

return strongHostedResult(input.allowPremiumModels)
```

`isStrongTask` must include only `plan`, `spec`, `review`, `refactor`, and `build`.
The final return implements the explicit fallback: balanced and quality-first
hosted-safe tasks use strong hosted unless an earlier premium rule applied. Cheap
results may offer strong hosted; strong results may offer cheap hosted plus premium
only when premium is allowed; local and blocked results must have no alternatives.

- [ ] **Step 4: Run the routing test file and confirm it passes**

Run: `npm run test -- src/ai/routing/routeAiRequest.test.ts`

Expected: PASS with every routing policy test green.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/ai/routing/routeAiRequest.ts src/ai/routing/routeAiRequest.test.ts
git commit -m "feat(routing): recommend privacy-aware model routes"
```

### Task 4: Document the capability and record project-memory status

**Files:**
- Modify: `README.md`
- Modify: `.friday/tasks.md`
- Modify: `.friday/decisions.md`

- [ ] **Step 1: Add a concise README current-capability note**

State that Friday now has a pure model-routing domain layer that recommends local,
cheap hosted, strong hosted, premium, or blocked routes, but does not call
providers. State that provider integrations and real model calls remain planned.

- [ ] **Step 2: Update the project task board**

Move the model-routing domain-types and policy items into Done. Replace the active
routing-shaping item with an in-progress privacy-classification or model-policy
refinement task.

- [ ] **Step 3: Add the approved decision record**

Append the exact decision heading and context, decision, reasoning, and trade-offs
from the feature request: `Build model routing as a pure policy layer before
provider integrations`.

- [ ] **Step 4: Commit documentation and project memory**

```bash
git add README.md .friday/tasks.md .friday/decisions.md
git commit -m "docs: record model routing policy layer"
```

### Task 5: Run full verification

**Files:**
- Verify: `src/ai/routing/modelRouting.ts`
- Verify: `src/ai/routing/routeAiRequest.ts`
- Verify: `src/ai/routing/routeAiRequest.test.ts`

- [ ] **Step 1: Check TypeScript without emitting**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 3: Build distributable JavaScript**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Run the repository quality gate**

Run: `npm run check`

Expected: PASS, including Prettier, TypeScript, Fallow, tests, and build.

- [ ] **Step 5: Inspect the final diff and status**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; status contains only the intended model-routing,
documentation, and project-memory changes before their final commit.
