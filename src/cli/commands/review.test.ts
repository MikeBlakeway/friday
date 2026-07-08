import { describe, expect, it } from 'vitest'

import { formatChangedFileContext, formatUntrackedFileContext, parseReviewArgs } from './review.js'

describe('parseReviewArgs', () => {
  it('accepts the changed-files workflow flag', () => {
    expect(parseReviewArgs(['--changed'])).toEqual({ changed: true })
  })

  it('rejects review commands without --changed', () => {
    expect(() => parseReviewArgs([])).toThrow(
      'A review source is required. Usage: friday review --changed',
    )
  })
})

describe('formatChangedFileContext', () => {
  it('groups git diff output by changed file path', () => {
    const changedFiles = formatChangedFileContext(`diff --git a/src/cli/index.ts b/src/cli/index.ts
index 1111111..2222222 100644
--- a/src/cli/index.ts
+++ b/src/cli/index.ts
@@ -1 +1,2 @@
 import { runHelpCommand } from './commands/help.js'
+import { runReviewCommand } from './commands/review.js'
diff --git a/src/cli/commands/review.ts b/src/cli/commands/review.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/cli/commands/review.ts
@@ -0,0 +1 @@
+export function runReviewCommand() {}
`)

    expect(changedFiles).toEqual([
      {
        filePath: 'src/cli/index.ts',
        diff: `diff --git a/src/cli/index.ts b/src/cli/index.ts
index 1111111..2222222 100644
--- a/src/cli/index.ts
+++ b/src/cli/index.ts
@@ -1 +1,2 @@
 import { runHelpCommand } from './commands/help.js'
+import { runReviewCommand } from './commands/review.js'`,
      },
      {
        filePath: 'src/cli/commands/review.ts',
        diff: `diff --git a/src/cli/commands/review.ts b/src/cli/commands/review.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/cli/commands/review.ts
@@ -0,0 +1 @@
+export function runReviewCommand() {}`,
      },
    ])
  })
})

describe('formatUntrackedFileContext', () => {
  it('formats untracked file contents as new-file diff context', () => {
    expect(
      formatUntrackedFileContext({
        filePath: 'src/ai/review/buildReviewPrompt.ts',
        content: "export function buildReviewPrompt() {\n  return 'prompt'\n}\n",
      }),
    ).toEqual({
      filePath: 'src/ai/review/buildReviewPrompt.ts',
      diff: `diff --git a/src/ai/review/buildReviewPrompt.ts b/src/ai/review/buildReviewPrompt.ts
new file mode 100644
--- /dev/null
+++ b/src/ai/review/buildReviewPrompt.ts
@@ -0,0 +1,3 @@
+export function buildReviewPrompt() {
+  return 'prompt'
+}`,
    })
  })
})
