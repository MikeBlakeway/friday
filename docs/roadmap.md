# Roadmap

Friday is currently focused on a no-provider local workflow MVP. The immediate
goal is to make the existing local pieces feel like one coherent product before
adding model execution.

## Current Implemented Foundation

- Node.js and strongly typed TypeScript CLI foundation
- `.friday/` project-memory templates and status inspection
- Project-memory loading
- Local evidence file preparation and evidence-pack generation
- Planning prompt workflow
- Review prompt workflow for changed files
- Deterministic privacy classification
- Common secret detection with redacted previews
- Pure model-routing policy and route preview command
- Advisory cost-estimation domain model
- Provider-neutral model interfaces and mock provider
- Vitest, TypeScript, Prettier, Fallow, and build checks

## MVP Work

1. Reconcile documentation and project memory with the current implemented state.
2. Define the MVP explicitly as a no-provider local workflow engine.
3. Integrate privacy classification, route recommendation, and advisory cost
   estimates into `friday plan` and `friday review`.
4. Expose the cost-estimation domain through `friday cost`.
5. Collect deterministic local evidence from Git, TypeScript, tests, and Fallow.
6. Add an example project that demonstrates Friday memory and generated output.
7. Add a simple architecture diagram that marks current and planned boundaries.

## Post-MVP Work

- Global developer memory and reusable policy files
- Usage logging and budget rules
- Local model provider implementation
- Hosted provider implementations
- Explicit premium escalation and approval flow
- Brainstorm, spec, design, refactor, and ship workflows
- Interactive terminal or desktop/web cockpit

## Deferred

- Autonomous coding
- Voice-first interaction
- Full IDE replacement
- Sending whole repositories to hosted providers by default
