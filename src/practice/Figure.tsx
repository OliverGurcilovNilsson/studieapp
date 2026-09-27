import { useAsset } from './useAssetUrl'

export function Figure({ courseId, assetId }: { courseId: string; assetId: string }) {
  const asset = useAsset(courseId, assetId)
  if (!asset) return null
  return (
    <figure className="figure">
      <img src={asset.url} alt={asset.caption ?? 'Figur till frågan'} />
      {asset.caption && <figcaption>{asset.caption}</figcaption>}
    </figure>
  )
}
