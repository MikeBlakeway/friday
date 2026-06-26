# Design

## Product Feel

Friday should feel professional, practical, calm, and useful: a focused developer
tool that helps users make better decisions with less context switching. It should
communicate clear boundaries, concrete outputs, and honest uncertainty rather than
performing as a conversational novelty.

## Developer Experience Principles

- Prefer local, inspectable files and deterministic output over opaque automation.
- Make the next useful action obvious and keep command output concise.
- Preserve user control: show what context was loaded, what evidence was used, and
  what would be shared before any future model call.
- Design for progressive capability: core workflows should remain useful without
  model integrations, then gain routing and provider support without changing their
  fundamental shape.
- Use simple defaults, explicit policy, and small incremental workflows instead of
  large autonomous operations.
- Treat privacy, cost, and model choice as first-class product concerns, not
  configuration afterthoughts.

## CLI Direction

The CLI is the current product surface. Commands should read like predictable
developer tooling: accept a clear goal, report local inputs and generated outputs,
and leave an inspectable artefact. Error messages should identify the missing local
prerequisite and the exact next command where possible.

## Future Cockpit Direction

A future interactive cockpit may provide a compact view of project memory, evidence,
model-routing decisions, privacy status, cost, and workflow history. It should sit
on top of the same local engine and files rather than become a separate source of
truth. The interface should prioritise clarity and reviewability over decorative
visual complexity.

Voice is a long-term interaction idea only. It is not part of the current product
scope and should not shape the CLI-first architecture.

## Public Brand Tone

Use direct, technically credible language. Position Friday as an AI workflow and
developer productivity project that demonstrates thoughtful platform engineering.
Avoid superhero references, toy-like metaphors, or claims that exceed implemented
capabilities.
