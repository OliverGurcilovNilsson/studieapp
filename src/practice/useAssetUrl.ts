import { useEffect, useState } from 'react'
import { db } from '../db/db'

/** Object URL for a stored asset (figure or article PDF); revoked on unmount. */
export function useAssetUrl(courseId: string, assetId?: string) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!assetId) return
    let objectUrl: string | undefined
    let alive = true
    db.assets.get([courseId, assetId]).then((a) => {
      if (!alive || !a) return
      objectUrl = URL.createObjectURL(a.blob)
      setUrl(objectUrl)
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [courseId, assetId])
  return url
}
