import { useEffect, useState } from 'react'
import { db } from '../db/db'

/** Object URL (plus caption) for a stored asset, a figure or an article PDF; revoked on unmount. */
export function useAsset(courseId: string, assetId?: string) {
  const [asset, setAsset] = useState<{ url: string; caption?: string; mime: string }>()
  useEffect(() => {
    if (!assetId) return
    let objectUrl: string | undefined
    let alive = true
    db.assets.get([courseId, assetId]).then((a) => {
      if (!alive || !a) return
      objectUrl = URL.createObjectURL(a.blob)
      setAsset({ url: objectUrl, caption: a.caption, mime: a.mime })
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [courseId, assetId])
  return asset
}

export function useAssetUrl(courseId: string, assetId?: string) {
  return useAsset(courseId, assetId)?.url
}
