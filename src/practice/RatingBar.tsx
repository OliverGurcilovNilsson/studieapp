import type { Grade } from 'ts-fsrs'
import { RATINGS } from '../lib/scheduler'

export function RatingBar({ intervals, onRate }: { intervals: Record<Grade, string>; onRate: (g: Grade) => void }) {
  return (
    <div className="rating">
      <div className="rating-title">Hur gick det?</div>
      <div className="rating-grid">
        {RATINGS.map((r) => (
          <button key={r.grade} className={`rate rate-${r.grade}`} onClick={() => onRate(r.grade)}>
            <span className="rate-label">{r.label}</span>
            <span className="rate-when">{intervals[r.grade]}</span>
            <kbd className="kbd">{r.key}</kbd>
          </button>
        ))}
      </div>
    </div>
  )
}
