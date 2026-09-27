import { describe, expect, it } from 'vitest'
import { checkNumeric, parseNumber, scoreMulti } from './scoring'

describe('parseNumber', () => {
  it.each([
    ['50', 50],
    ['1 234,5', 1234.5],
    ['1234.5', 1234.5],
    ['−19 000 000', -19000000],
    ['26,8 %', 26.8],
    ['0,00191', 0.00191],
  ])('parses %s', (input, expected) => expect(parseNumber(input)).toBe(expected))

  it('rejects text', () => expect(parseNumber('ungefär 50')).toBeUndefined())
})

describe('checkNumeric', () => {
  it('accepts a value within tolerance when no rounding rule is given', () => {
    expect(checkNumeric('26,8', { value: 26.8, tolerance: 0.1 })).toEqual({ kind: 'correct' })
    expect(checkNumeric('26,9', { value: 26.8, tolerance: 0.1 }).kind).toBe('correct')
    expect(checkNumeric('27,5', { value: 26.8, tolerance: 0.1 }).kind).toBe('wrong')
  })

  it('requires exact rounding when decimals are set', () => {
    const numeric = { value: 0.0306122, decimals: 3 }
    expect(checkNumeric('0,031', numeric)).toEqual({ kind: 'correct' })
    expect(checkNumeric('0,03', numeric).kind).toBe('wrong_rounding')
    expect(checkNumeric('0,0306', numeric).kind).toBe('wrong_rounding')
    expect(checkNumeric('0,5', numeric).kind).toBe('wrong')
  })

  it('treats a correctly rounded integer as correct', () => {
    expect(checkNumeric('50', { value: 50, decimals: 0 })).toEqual({ kind: 'correct' })
  })

  it('reports unparseable input', () => {
    expect(checkNumeric('femtio', { value: 50 }).kind).toBe('unparseable')
  })
})

describe('scoreMulti', () => {
  const correct = ['b', 'd', 'e', 'g']
  it('gives full points for exactly the right set', () => expect(scoreMulti(correct, correct, 2, true)).toBe(2))
  it('deducts for wrong choices with negative marking', () =>
    expect(scoreMulti(['b', 'd', 'a'], correct, 2, true)).toBe(0.5))
  it('never goes below zero', () => expect(scoreMulti(['a', 'c', 'f'], correct, 2, true)).toBe(0))
  it('without negative marking any wrong choice gives zero', () =>
    expect(scoreMulti(['b', 'a'], correct, 2)).toBe(0))
})
