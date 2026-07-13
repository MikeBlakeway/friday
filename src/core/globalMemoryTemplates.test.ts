import { describe, expect, it } from 'vitest'

import { classifyPromptPrivacy } from '../ai/privacy/classifyPromptPrivacy.js'
import { FRIDAY_GLOBAL_FILES } from './globalMemory.js'
import { getGlobalMemoryTemplate } from './globalMemoryTemplates.js'

describe('global memory templates', () => {
  it('provides useful defaults without classifying the policy wording as sensitive content', () => {
    for (const fileName of FRIDAY_GLOBAL_FILES) {
      const content = getGlobalMemoryTemplate(fileName)
      const classification = classifyPromptPrivacy({ content, filePath: fileName })

      expect(content.trim().length).toBeGreaterThan(0)
      expect(classification.privacyLevel).toBe('public')
      expect(classification.blocked).toBe(false)
    }
  })
})
