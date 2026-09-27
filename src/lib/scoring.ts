import type { Question } from '../content/schema'

export type NumericVerdict =
  | { kind: 'correct' }
  | { kind: 'wrong_rounding'; expected: string } // right value, wrong number of decimals
  | { kind: 'wrong'; expected: string }
  | { kind: 'unparseable' }

/** Parses Swedish or English number input: "1 234,5", "1234.5", "−19 000 000", "26,8 %". */
export function parseNumber(input: string): number | undefined {
  const cleaned = input
    .trim()
    .replace(/[−–]/g, '-') // minus sign, en dash
    .replace(/[\s  ]/g, '')
    .replace(/%$/, '')
    .replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return undefined
  return Number(cleaned)
}

function decimalsIn(input: string): number {
  const m = input.trim().replace(/%$/, '').match(/[.,](\d+)\s*$/)
  return m ? m[1].length : 0
}

export function formatSwedish(value: number, decimals?: number): string {
  return value.toLocaleString('sv-SE', {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 6,
  })
}

/**
 * Checks a numeric answer. When `decimals` is set, the grading guides deduct points for wrong
 * rounding, so the answer must be rounded to exactly that many decimals and match the rounded value.
 */
export function checkNumeric(input: string, numeric: NonNullable<Question['numeric']>): NumericVerdict {
  const value = parseNumber(input)
  if (value === undefined) return { kind: 'unparseable' }
  const { value: target, decimals, tolerance } = numeric
  const expected = formatSwedish(target, decimals)

  if (decimals !== undefined) {
    const rounded = Number(target.toFixed(decimals))
    const matchesValue = Math.abs(value - rounded) < 10 ** -(decimals + 6)
    if (matchesValue && decimalsIn(input) === decimals) return { kind: 'correct' }
    // Right magnitude but rounded differently (or not rounded at all).
    if (Math.abs(value - target) <= 10 ** -decimals) return { kind: 'wrong_rounding', expected }
    return { kind: 'wrong', expected }
  }

  const tol = tolerance ?? Math.max(Math.abs(target) * 1e-9, 1e-9)
  return Math.abs(value - target) <= tol ? { kind: 'correct' } : { kind: 'wrong', expected }
}

/**
 * Points for a multi-select question. With negative marking each correct choice earns
 * points/|correct| and each wrong choice costs the same; the total never drops below zero.
 */
export function scoreMulti(selected: string[], correct: string[], points: number, negativeMarking = false): number {
  const per = points / correct.length
  const right = selected.filter((s) => correct.includes(s)).length
  const wrong = selected.length - right
  if (!negativeMarking) return wrong === 0 ? right * per : 0
  return Math.max(0, (right - wrong) * per)
}
