import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { createHouseScene, VIEWS } from './scene.js'
import { address, derivation, facts, sources } from './property.js'
import './house.css'

function formatHour(h) {
  const hour = Math.floor(h)
  const minute = Math.round((h - hour) * 60)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${String(minute).padStart(2, '0')} ${suffix}`
}

export default function HouseViewer() {
  const mountRef = useRef(null)
  const apiRef = useRef(null)

  const [ready, setReady] = useState(false)
  const [view, setView] = useState('plan')
  const [hour, setHour] = useState(15.4)
  const [labels, setLabels] = useState(false)
  const [spin, setSpin] = useState(false)
  const [about, setAbout] = useState(false)
  const [factsOpen, setFactsOpen] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined

    let api
    try {
      api = createHouseScene(THREE, mount, { hour: 15.4, view: 'plan' })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return undefined
    }
    apiRef.current = api
    // Handle for the screenshot harness in scripts/: headless Chromium only
    // advances rAF when a frame is composited, so tests drive views directly.
    if (typeof window !== 'undefined') window.__house = api
    // One frame of headroom so the first render lands before the cover lifts.
    const id = requestAnimationFrame(() => setReady(true))

    return () => {
      cancelAnimationFrame(id)
      apiRef.current = null
      api.dispose()
    }
  }, [])

  const pickView = useCallback((id) => {
    setView(id)
    apiRef.current?.setView(id)
  }, [])

  useEffect(() => {
    apiRef.current?.setTimeOfDay(hour)
  }, [hour])

  useEffect(() => {
    apiRef.current?.setLabels(labels)
  }, [labels])

  useEffect(() => {
    apiRef.current?.setAutoRotate(spin)
  }, [spin])

  useEffect(() => {
    if (!about) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setAbout(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [about])

  const blurb = useMemo(() => VIEWS.find((v) => v.id === view)?.blurb ?? '', [view])

  return (
    <div className="viewer">
      <div className="viewer__canvas" ref={mountRef} />

      <div className={`loading${ready || error ? ' loading--gone' : ''}`}>
        {error ? 'WebGL unavailable' : 'Building the model'}
      </div>

      <header className="title panel">
        <p className="title__eyebrow">3D property study</p>
        <h1>{address.street}</h1>
        <p>
          {address.city}, {address.state} {address.zip} &middot; {address.subdivision}
        </p>
      </header>

      <aside className={`facts panel${factsOpen ? '' : ' facts--collapsed'}`} id="facts-panel">
        <div className="facts__head">
          <h2>Public record</h2>
          <button
            type="button"
            className="sheet__close"
            style={{ float: 'none', margin: 0 }}
            onClick={() => setFactsOpen(false)}
            aria-label="Hide property details"
          >
            &times;
          </button>
        </div>
        <dl>
          {facts.map((f) => (
            <div className="row" key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <p className="hint">Drag to orbit &middot; scroll to zoom &middot; right-drag to pan</p>

      <div className="controls panel">
        <div className="views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => pickView(v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>

        <p className="blurb">{blurb}</p>

        <div className="dial">
          <label htmlFor="tod">Light</label>
          <input
            id="tod"
            type="range"
            min="5"
            max="21"
            step="0.1"
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
          />
          <output htmlFor="tod">{formatHour(hour)}</output>
        </div>

        <div className="toggles">
          <button type="button" aria-pressed={labels} onClick={() => setLabels((v) => !v)}>
            Callouts
          </button>
          <button type="button" aria-pressed={spin} onClick={() => setSpin((v) => !v)}>
            Auto-orbit
          </button>
          <span className="spacer" />
          <button
            type="button"
            aria-pressed={factsOpen}
            aria-controls="facts-panel"
            onClick={() => setFactsOpen((v) => !v)}
          >
            Details
          </button>
          <button type="button" aria-pressed={about} onClick={() => setAbout(true)}>
            How this was built
          </button>
        </div>
      </div>

      {about && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="How this model was built" onClick={() => setAbout(false)}>
          <div className="sheet__inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="sheet__close" onClick={() => setAbout(false)} aria-label="Close">
              &times;
            </button>
            <h2>How this model was built</h2>
            <p>
              This is a <strong>data-informed reconstruction</strong>, not a survey, a scan, or a
              photogrammetric model. No aerial or satellite imagery of the property was used.
            </p>
            <p className="note">
              Every dimension below was reasoned out from the public property record. Anything
              tagged <strong>assumed</strong> is a plausible detail in the style of the tract, not a
              statement about the real house. Treat window placement, colours, planting and compass
              orientation as illustrative.
            </p>

            <h3>Element by element</h3>
            <div className="deriv">
              {derivation.map((d) => (
                <div className="deriv__row" key={d.element}>
                  <span>{d.element}</span>
                  <span>{d.basis}</span>
                  <span className={`tag tag--${d.confidence}`}>{d.confidence}</span>
                </div>
              ))}
            </div>

            <h3>Record sources</h3>
            <ul className="links">
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>

            <h3>Built with</h3>
            <p>
              three.js, rendered live in the browser. Geometry is generated procedurally in code
              from the dimensions in <code>src/house/property.js</code>, so correcting a number
              there re-shapes the model. Textures &mdash; stucco, concrete tile, gravel, turf, pool
              plaster, water &mdash; are all painted to canvas at runtime; there are no image
              assets. Lighting runs a full dawn-to-night cycle with a procedural sky that also
              drives image-based reflections.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
