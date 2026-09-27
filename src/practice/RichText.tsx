import { Fragment } from 'react'

/**
 * Renders extracted course text as plain text, with support for the only structure the
 * extraction produces: paragraphs and markdown pipe tables. Never renders HTML.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/)
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        if (lines.length >= 2 && lines.every((l) => l.trim().startsWith('|'))) {
          const rows = lines
            .filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)) // drop the |---| separator
            .map((l) =>
              l
                .trim()
                .replace(/^\||\|$/g, '')
                .split('|')
                .map((c) => c.trim()),
            )
          const [head, ...body] = rows
          return (
            <div className="table-wrap" key={i}>
              <table>
                <thead>
                  <tr>
                    {head.map((c, j) => (
                      <th key={j}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((r, k) => (
                    <tr key={k}>
                      {r.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return (
          <p key={i} className="rt-p">
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {l}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
