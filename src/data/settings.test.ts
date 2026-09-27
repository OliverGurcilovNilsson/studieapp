import { describe, expect, it } from 'vitest'
import { examDateFromInput, examDateToInput } from './settings'

describe('exam date input', () => {
  it('round-trips a date and stores the morning of the exam', () => {
    const epoch = examDateFromInput('2026-10-20')!
    expect(new Date(epoch).getHours()).toBe(8)
    expect(examDateToInput(epoch)).toBe('2026-10-20')
  })

  it('treats an empty or broken value as no exam date', () => {
    expect(examDateFromInput('')).toBeUndefined()
    expect(examDateFromInput('20 okt')).toBeUndefined()
    expect(examDateToInput(undefined)).toBe('')
  })
})
