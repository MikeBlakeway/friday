const PROJECT_TEMPLATE = `# Project

## Name

- Project name:

## Purpose

- What problem are we solving?

## Target Users

- Primary users:

## Current Stage

- Stage: idea | prototype | beta | production

## Core Goals

- Goal 1
- Goal 2

## Non-Goals

- Explicitly out of scope:

## Tech Stack

- Runtime:
- Language:
- Tooling:

## Open Questions

- Question 1
`;
const ARCHITECTURE_TEMPLATE = `# Architecture

## Overview

- High-level architecture summary.

## Key Modules

- Module:
- Responsibility:

## Data Flow

- Input -> processing -> output.

## Important Boundaries

- External dependencies:
- Trust boundaries:

## Architecture Decisions

- Link to key entries in decisions.md.
`;
const DECISIONS_TEMPLATE = `# Decisions

## Decision Template

### YYYY-MM-DD — Decision title

**Context**

- What situation requires a decision?

**Decision**

- What did we choose?

**Reasoning**

- Why this option over alternatives?

**Trade-offs**

- Benefits:
- Costs:
`;
const DESIGN_TEMPLATE = `# Design

## Product Feel

- Tone and interaction feel.

## Visual Direction

- Primary visual motifs and style notes.

## UX Principles

- Principle 1
- Principle 2

## Screens / Flows

- Core flow:
`;
const TASKS_TEMPLATE = `# Tasks

## Backlog

- [ ] Task title

## In Progress

- [ ] Task title

## Done

- [x] Task title
`;
const NOTES_TEMPLATE = `# Notes

Use this file for project-specific notes that are useful for Friday.

Avoid storing secrets, credentials, tokens, or private personal data here.
`;
export function getProjectTemplate(fileName) {
    switch (fileName) {
        case "project.md":
            return PROJECT_TEMPLATE;
        case "architecture.md":
            return ARCHITECTURE_TEMPLATE;
        case "decisions.md":
            return DECISIONS_TEMPLATE;
        case "design.md":
            return DESIGN_TEMPLATE;
        case "tasks.md":
            return TASKS_TEMPLATE;
        case "notes.md":
            return NOTES_TEMPLATE;
    }
}
