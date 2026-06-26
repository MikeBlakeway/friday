import { describe, expect, it } from 'vitest'

import { FRIDAY_PROJECT_FILES, type FridayProjectFile } from '../../src/core/fridayProject.js'
import { getProjectTemplate } from '../../src/core/projectTemplates.js'

const EXPECTED_HEADINGS: Record<FridayProjectFile, string> = {
  'project.md': '# Project',
  'architecture.md': '# Architecture',
  'decisions.md': '# Decisions',
  'design.md': '# Design',
  'tasks.md': '# Tasks',
  'notes.md': '# Notes',
}

describe('getProjectTemplate', () => {
  it('returns content for every FridayProjectFile', () => {
    for (const fileName of FRIDAY_PROJECT_FILES) {
      const content = getProjectTemplate(fileName)

      expect(content).toBeTruthy()
      expect(content.trim().length).toBeGreaterThan(0)
    }
  })

  it('includes the expected top-level heading for each file', () => {
    for (const fileName of FRIDAY_PROJECT_FILES) {
      const content = getProjectTemplate(fileName)
      const expectedHeading = EXPECTED_HEADINGS[fileName]

      expect(content).toContain(expectedHeading)
    }
  })
})
