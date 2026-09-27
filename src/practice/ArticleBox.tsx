import type { PracticeArticle, ReviewTemplate } from '../content/schema'
import { useAssetUrl } from './useAssetUrl'

export type TemplateItem = ReviewTemplate['items'][number]

/** The article a review question is about, with a link to open its PDF. */
export function ArticleBox({ courseId, article, item }: { courseId: string; article: PracticeArticle; item?: TemplateItem }) {
  const url = useAssetUrl(courseId, article.assetId)
  return (
    <div className="article-box">
      <div className="eyebrow">Artikel{article.design ? ` · ${article.design}` : ''}</div>
      <strong>{article.title}</strong>
      <div className="muted small">{article.citation}</div>
      {item && (
        <div className="small">
          Granskningsfråga {item.number} · {item.section}
        </div>
      )}
      {url && (
        <a className="btn btn-outline btn-small" href={url} target="_blank" rel="noopener noreferrer">
          Öppna artikeln (PDF)
        </a>
      )}
    </div>
  )
}
