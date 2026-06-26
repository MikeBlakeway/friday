import type { FridayProjectFile } from "./fridayProject.js";

const PROJECT_TEMPLATE = `# Project

## Name

## Purpose

## Target Users

## Current Stage

## Core Goals

## Non-Goals

## Tech Stack

## Open Questions
`;

const ARCHITECTURE_TEMPLATE = `# Architecture

## Overview

## Key Modules

## Data Flow

## Important Boundaries

## Architecture Decisions
`;

const DECISIONS_TEMPLATE = `# Decisions

## Decision Template

### YYYY-MM-DD — Decision title

**Context**

**Decision**

**Reasoning**

**Trade-offs**
`;

const DESIGN_TEMPLATE = `# Design

## Product Feel

## Visual Direction

## UX Principles

## Screens / Flows
`;

const TASKS_TEMPLATE = `# Tasks

## Backlog

## In Progress

## Done
`;

const NOTES_TEMPLATE = `# Notes

Use this file for project-specific notes that are useful for Friday.

Avoid storing secrets, credentials, tokens, or private personal data here.
`;

export function getProjectTemplate(fileName: FridayProjectFile): string {
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