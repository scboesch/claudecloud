/**
 * Portable helpers for the house scene.
 *
 * Every function takes the THREE namespace as its first argument so the same
 * code runs against the npm build and against a CDN global.
 */

/* ------------------------------------------------------------------ */
/* colour space compatibility                                          */
/* ------------------------------------------------------------------ */

export function setColorTexture(THREE, tex) {
  if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace
  else if ('sRGBEncoding' in THREE) tex.encoding = THREE.sRGBEncoding
  return tex
}

export function configureRenderer(THREE, renderer) {
  if ('outputColorSpace' in renderer && 'SRGBColorSpace' in THREE) {
    renderer.outputColorSpace = THREE.SRGBColorSpace
  } else if ('outputEncoding' in renderer && 'sRGBEncoding' in THREE) {
    renderer.outputEncoding = THREE.sRGBEncoding
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap ?? THREE.PCFShadowMap
}

/* ------------------------------------------------------------------ */
/* minimal orbit controls                                              */
/* ------------------------------------------------------------------ */

export function createOrbitControls(THREE, camera, dom, opts = {}) {
  const target = new THREE.Vector3()
  const spherical = new THREE.Spherical()
  const delta = { theta: 0, phi: 0 }
  const panOffset = new THREE.Vector3()
  const pointers = new Map()
  let zoomScale = 1
  let pinchDistance = 0

  const c = {
    target,
    enabled: true,
    enablePan: opts.enablePan !== false,
    minDistance: opts.minDistance ?? 12,
    maxDistance: opts.maxDistance ?? 420,
    minPolarAngle: opts.minPolarAngle ?? 0.08,
    maxPolarAngle: opts.maxPolarAngle ?? Math.PI / 2 - 0.03,
    damping: 0.09,
    rotateSpeed: 1,
    zoomSpeed: 1,
    autoRotate: false,
    autoRotateSpeed: 0.22,
    /** Set true by any user gesture; the caller uses it to cancel fly-tos. */
    interacting: false,
  }

  const el = dom
  const size = () => ({ w: el.clientWidth || 1, h: el.clientHeight || 1 })

  function onPointerDown(e) {
    if (!c.enabled) return
    el.setPointerCapture?.(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button })
    if (pointers.size === 2) pinchDistance = twoPointerDistance()
    c.interacting = true
  }

  function twoPointerDistance() {
    const [a, b] = [...pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function onPointerMove(e) {
    if (!c.enabled || !pointers.has(e.pointerId)) return
    const prev = pointers.get(e.pointerId)
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: prev.button })
    const { w, h } = size()

    if (pointers.size === 2) {
      const d = twoPointerDistance()
      if (pinchDistance > 0) zoomScale *= Math.pow(0.98, (d - pinchDistance) * 0.5)
      pinchDistance = d
      return
    }

    const panning = prev.button === 2 || prev.button === 1 || e.shiftKey
    if (panning && c.enablePan) {
      pan(dx, dy, w, h)
    } else {
      delta.theta -= (2 * Math.PI * dx * c.rotateSpeed) / w
      delta.phi -= (2 * Math.PI * dy * c.rotateSpeed) / h
    }
    c.interacting = true
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchDistance = 0
    el.releasePointerCapture?.(e.pointerId)
  }

  function onWheel(e) {
    if (!c.enabled) return
    e.preventDefault()
    zoomScale *= Math.pow(0.95, -Math.sign(e.deltaY) * c.zoomSpeed)
    c.interacting = true
  }

  const v = new THREE.Vector3()
  function pan(dx, dy, w, h) {
    const offset = v.copy(camera.position).sub(target)
    // Screen-space pan distance at the target plane.
    const distance = offset.length() * Math.tan(((camera.fov / 2) * Math.PI) / 180) * 2
    const m = camera.matrix.elements
    panOffset.x += -(dx * distance) / h * m[0] + (dy * distance) / h * m[4]
    panOffset.y += -(dx * distance) / h * m[1] + (dy * distance) / h * m[5]
    panOffset.z += -(dx * distance) / h * m[2] + (dy * distance) / h * m[6]
  }

  function onContextMenu(e) {
    e.preventDefault()
  }

  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  el.addEventListener('pointercancel', onPointerUp)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('contextmenu', onContextMenu)

  const offset = new THREE.Vector3()

  c.update = function update(dt = 0.016) {
    offset.copy(camera.position).sub(target)
    spherical.setFromVector3(offset)

    if (c.autoRotate && pointers.size === 0) {
      spherical.theta -= c.autoRotateSpeed * dt
    }

    spherical.theta += delta.theta
    spherical.phi += delta.phi
    spherical.phi = Math.max(c.minPolarAngle, Math.min(c.maxPolarAngle, spherical.phi))
    spherical.makeSafe()
    spherical.radius = Math.max(
      c.minDistance,
      Math.min(c.maxDistance, spherical.radius * zoomScale),
    )

    target.add(panOffset)
    offset.setFromSpherical(spherical)
    camera.position.copy(target).add(offset)
    camera.lookAt(target)

    const keep = 1 - c.damping
    delta.theta *= keep
    delta.phi *= keep
    panOffset.multiplyScalar(keep)
    zoomScale = 1 + (zoomScale - 1) * keep

    if (
      pointers.size === 0 &&
      Math.abs(delta.theta) < 1e-5 &&
      Math.abs(delta.phi) < 1e-5 &&
      panOffset.lengthSq() < 1e-6
    ) {
      c.interacting = false
    }
  }

  c.dispose = function dispose() {
    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerUp)
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('contextmenu', onContextMenu)
    pointers.clear()
  }

  return c
}

/* ------------------------------------------------------------------ */
/* procedural textures                                                 */
/* ------------------------------------------------------------------ */

function canvas2d(size, h) {
  const el = document.createElement('canvas')
  el.width = size
  el.height = h ?? size
  return [el, el.getContext('2d')]
}

function noise(ctx, w, h, amount, alpha) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
    if (alpha != null) d[i + 3] = alpha
  }
  ctx.putImageData(img, 0, 0)
}

function makeTexture(THREE, el, repeat, srgb = true) {
  const tex = new THREE.CanvasTexture(el)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  if (repeat) tex.repeat.set(repeat[0], repeat[1])
  if (srgb) setColorTexture(THREE, tex)
  tex.anisotropy = 8
  return tex
}

/** Troweled stucco: fine grain plus soft trowel swirls. */
export function stuccoTexture(THREE, color = '#e8dcc6', repeat = [6, 6]) {
  const [el, ctx] = canvas2d(512)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 900; i++) {
    ctx.beginPath()
    const r = 6 + Math.random() * 26
    ctx.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`
    ctx.fill()
    ctx.beginPath()
    ctx.arc(Math.random() * 512, Math.random() * 512, r * 0.7, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`
    ctx.fill()
  }
  noise(ctx, 512, 512, 16)
  return makeTexture(THREE, el, repeat)
}

/** Height-ish map reused as a bump for stucco. */
export function stuccoBump(THREE, repeat = [6, 6]) {
  const [el, ctx] = canvas2d(512)
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 1400; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 12, 0, Math.PI * 2)
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
    ctx.fill()
  }
  noise(ctx, 512, 512, 26)
  return makeTexture(THREE, el, repeat, false)
}

/** Mission / barrel concrete tile, drawn as staggered rows of half-cylinders. */
export function roofTileTexture(THREE, repeat = [10, 8]) {
  const W = 512
  const H = 512
  const [el, ctx] = canvas2d(W, H)
  ctx.fillStyle = '#6d4030'
  ctx.fillRect(0, 0, W, H)

  const rows = 8
  const cols = 8
  const rowH = H / rows
  const colW = W / cols

  for (let r = 0; r < rows; r++) {
    const y = r * rowH
    // Shadow line under the course above.
    ctx.fillStyle = 'rgba(0,0,0,0.34)'
    ctx.fillRect(0, y, W, rowH * 0.16)
    for (let cIdx = -1; cIdx <= cols; cIdx++) {
      const x = cIdx * colW + (r % 2 ? colW / 2 : 0)
      const g = ctx.createLinearGradient(x, 0, x + colW, 0)
      // Colour variation per tile keeps it from looking printed.
      const t = Math.random()
      const base = t < 0.25 ? [150, 82, 58] : t < 0.6 ? [128, 68, 48] : [110, 60, 44]
      g.addColorStop(0, `rgb(${base[0] * 0.55},${base[1] * 0.55},${base[2] * 0.55})`)
      g.addColorStop(0.35, `rgb(${base[0]},${base[1]},${base[2]})`)
      g.addColorStop(0.62, `rgb(${Math.min(255, base[0] * 1.25)},${base[1] * 1.2},${base[2] * 1.2})`)
      g.addColorStop(1, `rgb(${base[0] * 0.5},${base[1] * 0.5},${base[2] * 0.5})`)
      ctx.fillStyle = g
      ctx.fillRect(x, y + rowH * 0.14, colW * 0.98, rowH * 0.88)
    }
  }
  noise(ctx, W, H, 14)
  return makeTexture(THREE, el, repeat)
}

export function roofTileBump(THREE, repeat = [10, 8]) {
  const W = 512
  const H = 512
  const [el, ctx] = canvas2d(W, H)
  ctx.fillStyle = '#404040'
  ctx.fillRect(0, 0, W, H)
  const rows = 8
  const cols = 8
  const rowH = H / rows
  const colW = W / cols
  for (let r = 0; r < rows; r++) {
    const y = r * rowH
    for (let cIdx = -1; cIdx <= cols; cIdx++) {
      const x = cIdx * colW + (r % 2 ? colW / 2 : 0)
      const g = ctx.createLinearGradient(x, 0, x + colW, 0)
      g.addColorStop(0, '#101010')
      g.addColorStop(0.5, '#f0f0f0')
      g.addColorStop(1, '#101010')
      ctx.fillStyle = g
      ctx.fillRect(x, y + rowH * 0.14, colW * 0.98, rowH * 0.88)
    }
  }
  return makeTexture(THREE, el, repeat, false)
}

/** Decomposed granite / desert landscape gravel. */
export function gravelTexture(THREE, repeat = [12, 12], tint = [190, 150, 110]) {
  const [el, ctx] = canvas2d(512)
  ctx.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 9000; i++) {
    const s = 1 + Math.random() * 3.4
    const f = 0.6 + Math.random() * 0.7
    ctx.fillStyle = `rgba(${tint[0] * f | 0},${tint[1] * f | 0},${tint[2] * f | 0},0.85)`
    ctx.fillRect(Math.random() * 512, Math.random() * 512, s, s)
  }
  noise(ctx, 512, 512, 18)
  return makeTexture(THREE, el, repeat)
}

/** Turf, with a faint mow-stripe so the lawn reads as maintained. */
export function grassTexture(THREE, repeat = [8, 8]) {
  const [el, ctx] = canvas2d(512)
  ctx.fillStyle = '#4b7a34'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 14000; i++) {
    const f = 0.65 + Math.random() * 0.75
    ctx.fillStyle = `rgba(${75 * f | 0},${122 * f | 0},${52 * f | 0},0.9)`
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 3 + Math.random() * 4)
  }
  for (let s = 0; s < 512; s += 64) {
    ctx.fillStyle = 'rgba(255,255,255,0.035)'
    ctx.fillRect(s, 0, 32, 512)
  }
  return makeTexture(THREE, el, repeat)
}

/** Broom-finished concrete for the drive, walks and pool deck. */
export function concreteTexture(THREE, repeat = [6, 6], base = '#c9c3b6') {
  const [el, ctx] = canvas2d(512)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 700; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 40, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.05)'
  for (let y = 0; y < 512; y += 3) {
    ctx.beginPath()
    ctx.moveTo(0, y + Math.random() * 2)
    ctx.lineTo(512, y + Math.random() * 2)
    ctx.stroke()
  }
  noise(ctx, 512, 512, 14)
  return makeTexture(THREE, el, repeat)
}

/** Pool plaster: pebble-tec speckle over a blue base. */
export function poolPlasterTexture(THREE, repeat = [4, 4]) {
  const [el, ctx] = canvas2d(512)
  ctx.fillStyle = '#2f6f88'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 12000; i++) {
    const f = 0.7 + Math.random() * 0.8
    ctx.fillStyle = `rgba(${60 * f | 0},${130 * f | 0},${150 * f | 0},0.8)`
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
  }
  return makeTexture(THREE, el, repeat)
}

/** Tiling normal map of wind ripples, scrolled at runtime for water. */
export function waterNormalTexture(THREE, repeat = [8, 8]) {
  const N = 256
  const [el, ctx] = canvas2d(N)
  const img = ctx.createImageData(N, N)
  const height = new Float32Array(N * N)

  // A few sine waves at different angles wrap seamlessly on the tile.
  const waves = []
  for (let i = 0; i < 5; i++) {
    const kx = Math.round(-3 + Math.random() * 6) || 1
    const ky = Math.round(-3 + Math.random() * 6) || 1
    waves.push({ kx, ky, amp: 1 / (i + 1), phase: Math.random() * Math.PI * 2 })
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let h = 0
      for (const w of waves) {
        h += w.amp * Math.sin((2 * Math.PI * (w.kx * x + w.ky * y)) / N + w.phase)
      }
      height[y * N + x] = h
    }
  }
  const strength = 2.2
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const l = height[y * N + ((x - 1 + N) % N)]
      const r = height[y * N + ((x + 1) % N)]
      const u = height[((y - 1 + N) % N) * N + x]
      const d = height[((y + 1) % N) * N + x]
      let nx = (l - r) * strength
      let ny = (u - d) * strength
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      const i = (y * N + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255
      img.data[i + 2] = (nz / len) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return makeTexture(THREE, el, repeat, false)
}

/* ------------------------------------------------------------------ */
/* roof geometry                                                       */
/* ------------------------------------------------------------------ */

/**
 * Hip roof over a w x d rectangle. Eave sits at y = 0, ridge runs along the
 * longer axis. UVs are in feet so one tile texture scale works everywhere.
 */
export function hipRoofGeometry(THREE, w, d, pitch) {
  const hw = w / 2
  const hd = d / 2
  const rise = pitch * Math.min(w, d) / 2
  const ridgeAlongX = w >= d
  const rl = ridgeAlongX ? (w - d) / 2 : (d - w) / 2
  const run = Math.min(hw, hd)
  const slopeLen = Math.hypot(run, rise)

  const pos = []
  const uv = []

  // u runs along the eave, v up the slope; both in feet.
  const push = (p, u, vv) => {
    pos.push(p[0], p[1], p[2])
    uv.push(u, vv)
  }
  const quad = (a, b, c, e, uf) => {
    push(a, uf(a), (a[1] / rise) * slopeLen)
    push(b, uf(b), (b[1] / rise) * slopeLen)
    push(c, uf(c), (c[1] / rise) * slopeLen)
    push(a, uf(a), (a[1] / rise) * slopeLen)
    push(c, uf(c), (c[1] / rise) * slopeLen)
    push(e, uf(e), (e[1] / rise) * slopeLen)
  }
  const tri = (a, b, c, uf) => {
    push(a, uf(a), (a[1] / rise) * slopeLen)
    push(b, uf(b), (b[1] / rise) * slopeLen)
    push(c, uf(c), (c[1] / rise) * slopeLen)
  }

  const ux = (p) => p[0]
  const uz = (p) => p[2]

  if (ridgeAlongX) {
    const r0 = [-rl, rise, 0]
    const r1 = [rl, rise, 0]
    quad([-hw, 0, hd], [hw, 0, hd], r1, r0, ux)
    quad([hw, 0, -hd], [-hw, 0, -hd], r0, r1, ux)
    tri([hw, 0, hd], [hw, 0, -hd], r1, uz)
    tri([-hw, 0, -hd], [-hw, 0, hd], r0, uz)
  } else {
    const r0 = [0, rise, -rl]
    const r1 = [0, rise, rl]
    tri([-hw, 0, hd], [hw, 0, hd], r1, ux)
    tri([hw, 0, -hd], [-hw, 0, -hd], r0, ux)
    quad([hw, 0, hd], [hw, 0, -hd], r0, r1, uz)
    quad([-hw, 0, -hd], [-hw, 0, hd], r1, r0, uz)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.computeVertexNormals()
  geo.userData.rise = rise
  return geo
}

/** Gable roof over a w x d rectangle; ridge runs along Z. */
export function gableRoofGeometry(THREE, w, d, pitch) {
  const hw = w / 2
  const hd = d / 2
  const rise = pitch * hw
  const slopeLen = Math.hypot(hw, rise)
  const pos = []
  const uv = []
  const push = (p, u) => {
    pos.push(p[0], p[1], p[2])
    uv.push(u, (p[1] / rise) * slopeLen)
  }
  const quad = (a, b, c, e) => {
    for (const p of [a, b, c, a, c, e]) push(p, p[2])
  }
  quad([hw, 0, hd], [hw, 0, -hd], [0, rise, -hd], [0, rise, hd])
  quad([-hw, 0, -hd], [-hw, 0, hd], [0, rise, hd], [0, rise, -hd])

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.computeVertexNormals()
  geo.userData.rise = rise
  return geo
}

/** Rounded-rectangle shape, used for the pool and planter beds. */
export function roundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape()
  const hw = w / 2
  const hh = h / 2
  s.moveTo(-hw + r, -hh)
  s.lineTo(hw - r, -hh)
  s.quadraticCurveTo(hw, -hh, hw, -hh + r)
  s.lineTo(hw, hh - r)
  s.quadraticCurveTo(hw, hh, hw - r, hh)
  s.lineTo(-hw + r, hh)
  s.quadraticCurveTo(-hw, hh, -hw, hh - r)
  s.lineTo(-hw, -hh + r)
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
  return s
}

/* ------------------------------------------------------------------ */
/* sky                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Equirectangular sky painted to a canvas: gradient, sun disc with glow,
 * horizon haze and (at night) stars. Used as both background and, through
 * PMREM, the environment map.
 */
export function paintSky(ctx, W, H, params) {
  const { zenith, horizon, ground, sunColor, sunAzimuth, sunElevation, sunIntensity, stars } = params

  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, zenith)
  g.addColorStop(0.45, horizon)
  g.addColorStop(0.5, horizon)
  g.addColorStop(0.52, ground)
  g.addColorStop(1, ground)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  if (stars > 0) {
    for (let i = 0; i < 1500; i++) {
      const y = Math.random() * H * 0.5
      const a = stars * 0.42 * (0.2 + Math.random() * 0.8) * (1 - y / (H * 0.5)) ** 0.4
      const r = Math.random() < 0.12 ? 1.7 : 1.1
      ctx.fillStyle = `rgba(255,255,245,${a})`
      ctx.fillRect(Math.random() * W, y, r, r)
    }
  }

  // Equirect: u = azimuth / 2pi, v = (90deg - elevation) / 180deg.
  const sx = ((sunAzimuth / (Math.PI * 2)) % 1 + 1) % 1 * W
  const sy = (0.5 - sunElevation / Math.PI) * H

  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.2)
  glow.addColorStop(0, sunColor)
  glow.addColorStop(0.045, sunColor)
  glow.addColorStop(0.22, 'rgba(255,196,132,0.1)')
  glow.addColorStop(1, 'rgba(255,196,132,0)')
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = Math.max(0.12, sunIntensity * 0.8)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Wrap the glow across the seam so the environment stays continuous.
  ctx.save()
  ctx.translate(sx > W / 2 ? -W : W, 0)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
