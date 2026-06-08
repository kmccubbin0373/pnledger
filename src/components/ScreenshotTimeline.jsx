import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const ORDER = ['Entry', 'HTF', 'Alert', 'Exit', 'Other', '']

function useBlobUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function TimelineItem({ shot, onOpen }) {
  const url = useBlobUrl(shot.blob)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 92 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {shot.label || 'Shot'}
      </div>
      {url && (
        <img src={url} alt={shot.name} onClick={() => onOpen(url)}
          style={{ width: 88, height: 60, objectFit: 'cover', borderRadius: 'var(--radius)', border: '0.5px solid var(--border-strong)', cursor: 'zoom-in' }} />
      )}
    </div>
  )
}

// Read-only ordered timeline of a trade's screenshots, grouped by label order,
// with a full-screen lightbox on click.
export default function ScreenshotTimeline({ shots }) {
  const [lightbox, setLightbox] = useState(null)
  if (!shots || shots.length === 0) return null

  const ordered = [...shots].sort(
    (a, b) => ORDER.indexOf(a.label || '') - ORDER.indexOf(b.label || '')
  )

  return (
    <>
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '4px 0', alignItems: 'flex-start' }}>
        {ordered.map((s, i) => (
          <TimelineItem key={i} shot={s} onOpen={setLightbox} />
        ))}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button className="icon-btn" onClick={() => setLightbox(null)} aria-label="Close"
            style={{ position: 'absolute', top: 16, right: 16, background: 'var(--surface)', borderRadius: '50%', padding: 6 }}>
            <X size={18} />
          </button>
          <img src={lightbox} alt="" style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 8, boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }} />
        </div>
      )}
    </>
  )
}
