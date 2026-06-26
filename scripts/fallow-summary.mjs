import { readFile } from 'node:fs/promises'
import path from 'node:path'

const REPORT_DIR = path.join(process.cwd(), 'reports', 'fallow')

const REPORT_FILES = [
  { label: 'dead-code', fileName: 'dead-code.json' },
  { label: 'dupes', fileName: 'dupes.json' },
  { label: 'health', fileName: 'health.json' },
]

function parseJson(content, filePath) {
  try {
    return JSON.parse(content)
  } catch {
    throw new Error(`Could not parse JSON report: ${filePath}`)
  }
}

function countBy(items, keySelector) {
  const counts = new Map()

  for (const item of items) {
    const key = keySelector(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function summarizeReport(report) {
  if (!report || typeof report !== 'object') {
    return {
      totalFindings: 0,
      details: [],
      topRules: [],
    }
  }

  if (report.kind === 'dead-code') {
    const totalFindings =
      typeof report.total_issues === 'number'
        ? report.total_issues
        : typeof report.summary?.total_issues === 'number'
          ? report.summary.total_issues
          : 0

    const summary = report.summary ?? {}
    const categoryCounts = Object.entries(summary)
      .filter(([key, value]) => key !== 'total_issues' && typeof value === 'number' && value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key, value]) => `${key}=${value}`)

    return {
      totalFindings,
      details: categoryCounts.length > 0 ? [`categories: ${categoryCounts.join(', ')}`] : [],
      topRules: [],
    }
  }

  if (report.kind === 'dupes') {
    const cloneGroups = Array.isArray(report.clone_groups) ? report.clone_groups.length : 0
    const duplicationPct = report.stats?.duplication_percentage
    const lines = report.stats?.duplicated_lines

    const details = []
    if (typeof duplicationPct === 'number') {
      details.push(`duplication=${duplicationPct.toFixed(2)}%`)
    }
    if (typeof lines === 'number') {
      details.push(`duplicated_lines=${lines}`)
    }

    return {
      totalFindings: cloneGroups,
      details: details.length > 0 ? [details.join(', ')] : [],
      topRules: [],
    }
  }

  if (report.kind === 'health') {
    const findings = Array.isArray(report.findings) ? report.findings : []
    const summary = report.summary ?? {}
    const severity = [
      ['high', summary.severity_high_count],
      ['moderate', summary.severity_moderate_count],
      ['critical', summary.severity_critical_count],
    ]
      .filter(([, count]) => typeof count === 'number' && count > 0)
      .map(([level, count]) => `${level}=${count}`)

    const details = []
    if (severity.length > 0) {
      details.push(`severity: ${severity.join(', ')}`)
    }
    if (typeof report.health_score?.score === 'number') {
      details.push(
        `score=${report.health_score.score.toFixed(1)} (${report.health_score.grade ?? 'n/a'})`,
      )
    }

    return {
      totalFindings: findings.length,
      details,
      topRules: [],
    }
  }

  // Fallback for SARIF-like structures.
  const runs = Array.isArray(report.runs) ? report.runs : []
  const results = runs.flatMap((run) =>
    Array.isArray(run.results)
      ? run.results.map((result) => ({
          ruleId: typeof result.ruleId === 'string' ? result.ruleId : 'unknown-rule',
          level: typeof result.level === 'string' ? result.level : 'note',
        }))
      : [],
  )

  const levelCounts = countBy(results, (result) => result.level)
  const topRules = countBy(results, (result) => result.ruleId).slice(0, 5)

  return {
    totalFindings: results.length,
    details:
      levelCounts.length > 0
        ? [`levels: ${levelCounts.map(([level, count]) => `${level}=${count}`).join(', ')}`]
        : [],
    topRules,
  }
}

async function loadReport(label, fileName) {
  const filePath = path.join(REPORT_DIR, fileName)

  try {
    const content = await readFile(filePath, { encoding: 'utf8' })
    const json = parseJson(content, filePath)
    const summary = summarizeReport(json)

    return { label, filePath, summary, missing: false }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {
        label,
        filePath,
        summary: { totalFindings: 0, details: [], topRules: [] },
        missing: true,
      }
    }

    throw error
  }
}

async function main() {
  const reports = await Promise.all(
    REPORT_FILES.map(({ label, fileName }) => loadReport(label, fileName)),
  )

  console.log('Fallow summary')
  console.log('')

  for (const report of reports) {
    if (report.missing) {
      console.log(`- ${report.label}: report missing (${report.filePath})`)
      continue
    }

    const total = report.summary.totalFindings

    console.log(`- ${report.label}: ${total} finding(s)`)

    for (const detail of report.summary.details) {
      console.log(`  ${detail}`)
    }

    if (report.summary.topRules.length > 0) {
      const rules = report.summary.topRules
        .map(([ruleId, count]) => `${ruleId} (${count})`)
        .join(', ')
      console.log(`  top rules: ${rules}`)
    }
  }

  console.log('')
  console.log('Tip: run npm run fallow:review to refresh reports and summary.')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Fallow summary error: ${message}`)
  process.exitCode = 1
})
