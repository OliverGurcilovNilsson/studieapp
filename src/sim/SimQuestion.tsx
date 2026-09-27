import type { PracticeArticle, Question } from '../content/schema'
import { ArticleBox, type TemplateItem } from '../practice/ArticleBox'
import { Figure } from '../practice/Figure'
import { RichText } from '../practice/RichText'
import { questionHeading, type SimAnswer } from '../lib/examSim'

const LETTERS = 'ABCDEFGH'
/** One exam question without any feedback: she answers, the scoring comes after she hands in. */
export function SimQuestion({
  courseId,
  question: q,
  answer = {},
  onChange,
  article,
}: {
  courseId: string
  question: Question
  answer?: SimAnswer
  onChange: (a: SimAnswer) => void
  article?: { article: PracticeArticle; item?: TemplateItem }
}) {
  const options = q.options ?? []
  const toggle = (id: string) => {
    const s = answer.selected ?? []
    onChange({ ...answer, selected: s.includes(id) ? s.filter((x) => x !== id) : [...s, id] })
  }
  return (
    <div className="runner-body">
      <div className="runner-q">
        <div className="q-label">{questionHeading(q)}</div>
        {article && <ArticleBox courseId={courseId} article={article.article} item={article.item} />}
        <div className="q-card">
          {q.context && <RichText className="q-context" text={q.context} />}
          <div className="q-eyebrow">fråga</div>
          <RichText className="q-prompt" text={q.prompt} />
        </div>
        {q.assetIds?.map((id) => <Figure key={id} courseId={courseId} assetId={id} />)}
      </div>
      <div className="runner-a">
        {(q.type === 'mcq' || q.type === 'mcq_multi') && (
          <>
            {q.type === 'mcq_multi' && (
              <p className="muted small">Välj alla som stämmer.{q.negativeMarking ? ' Fel val ger avdrag.' : ''}</p>
            )}
            <div className="options" role={q.type === 'mcq' ? 'radiogroup' : 'group'} aria-label="Svarsalternativ">
              {options.map((o, i) => {
                const on = q.type === 'mcq' ? answer.choice === o.id : !!answer.selected?.includes(o.id)
                return (
                  <button
                    key={o.id}
                    className={`option ${on ? 'is-selected' : ''}`}
                    role={q.type === 'mcq' ? 'radio' : 'checkbox'}
                    aria-checked={on}
                    onClick={() => (q.type === 'mcq' ? onChange({ ...answer, choice: on ? undefined : o.id }) : toggle(o.id))}
                  >
                    <span className="option-key">{LETTERS[i]}</span>
                    <span className="option-text">{o.text}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
        {q.type === 'calculation' && q.numeric ? (
          <div className="calc">
            <label htmlFor={`sim-${q.id}`} className="field-label">
              Ditt svar
            </label>
            <div className="calc-row">
              <input
                id={`sim-${q.id}`}
                inputMode="decimal"
                autoComplete="off"
                value={answer.input ?? ''}
                onChange={(e) => onChange({ ...answer, input: e.target.value })}
              />
              {q.numeric.unit && <span className="calc-unit">{q.numeric.unit}</span>}
            </div>
            {q.numeric.decimals !== undefined && (
              <p className="muted small">
                Avrunda till {q.numeric.decimals} {q.numeric.decimals === 1 ? 'decimal' : 'decimaler'}.
              </p>
            )}
          </div>
        ) : (
          q.type !== 'mcq' &&
          q.type !== 'mcq_multi' && (
            <>
              <label htmlFor={`sim-${q.id}`} className="field-label">
                Ditt svar
              </label>
              <textarea
                id={`sim-${q.id}`}
                className="draft"
                rows={9}
                value={answer.text ?? ''}
                onChange={(e) => onChange({ ...answer, text: e.target.value })}
              />
            </>
          )
        )}
      </div>
    </div>
  )
}
