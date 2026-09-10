/**
 * 3D scene for 1181 W Redondo Dr.
 *
 * Units are feet. Orientation is nominal, not georeferenced: the street side
 * is treated as east (+Z) and the lake as west (-Z), so the sun rises over the
 * front elevation and sets over the water.
 *
 * `THREE` is injected so this module works with both the npm package and a
 * CDN global build.
 */

import { model } from './property.js'
import {
  configureRenderer,
  createOrbitControls,
  gableRoofGeometry,
  grassTexture,
  gravelTexture,
  hipRoofGeometry,
  concreteTexture,
  paintSky,
  poolPlasterTexture,
  roofTileBump,
  roofTileTexture,
  roundedRectShape,
  setColorTexture,
  stuccoBump,
  stuccoTexture,
  waterNormalTexture,
} from './lib.js'

const DEG = Math.PI / 180

/* ------------------------------------------------------------------ */
/* time of day                                                         */
/* ------------------------------------------------------------------ */

/**
 * Keyframes across a day. Azimuth is measured from due east (+Z) turning
 * toward due south (+X), matching the nominal site orientation above.
 */
const DAY = [
  { hour: 5.0, elev: -6, azim: -12, sun: '#3a4a86', sunI: 0.05, hemi: 0.16, amb: 0.055,
    zenith: '#0b1130', horizon: '#3d3a6b', ground: '#1a1830', stars: 0.85, glow: 1.0, exposure: 1.05 },
  { hour: 6.2, elev: 4, azim: 0, sun: '#ff7a3c', sunI: 0.9, hemi: 0.40, amb: 0.10,
    zenith: '#26407e', horizon: '#f2a06a', ground: '#5c4436', stars: 0.15, glow: 0.7, exposure: 0.94 },
  { hour: 8.0, elev: 22, azim: 22, sun: '#ffcf9c', sunI: 2.1, hemi: 0.62, amb: 0.13,
    zenith: '#2f6fc4', horizon: '#a8cfee', ground: '#7a6a54', stars: 0, glow: 0.25, exposure: 0.90 },
  { hour: 12.0, elev: 74, azim: 88, sun: '#fff3df', sunI: 3.0, hemi: 0.78, amb: 0.16,
    zenith: '#2a6fd0', horizon: '#cfe6fb', ground: '#93856c', stars: 0, glow: 0, exposure: 0.86 },
  { hour: 16.0, elev: 34, azim: 148, sun: '#ffdcae', sunI: 2.3, hemi: 0.66, amb: 0.14,
    zenith: '#3277cc', horizon: '#c3ddf4', ground: '#8b7c62', stars: 0, glow: 0.1, exposure: 0.88 },
  { hour: 18.6, elev: 6, azim: 172, sun: '#ff8a45', sunI: 1.5, hemi: 0.44, amb: 0.11,
    zenith: '#2b4a8e', horizon: '#ff9e5e', ground: '#5e4636', stars: 0.05, glow: 0.55, exposure: 0.95 },
  { hour: 19.5, elev: -2, azim: 182, sun: '#ff5f2e', sunI: 0.45, hemi: 0.30, amb: 0.09,
    zenith: '#1b2a63', horizon: '#f2673c', ground: '#3a2c2c', stars: 0.3, glow: 0.9, exposure: 1.02 },
  { hour: 21.0, elev: -12, azim: 196, sun: '#6f86c8', sunI: 0.12, hemi: 0.18, amb: 0.06,
    zenith: '#070d24', horizon: '#1a2450', ground: '#12162c', stars: 1.0, glow: 1.0, exposure: 1.12 },
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function sampleDay(THREE, hour) {
  let i = 0
  while (i < DAY.length - 2 && hour > DAY[i + 1].hour) i++
  const a = DAY[i]
  const b = DAY[i + 1]
  const t = Math.max(0, Math.min(1, (hour - a.hour) / (b.hour - a.hour)))
  const col = (ka, kb) => new THREE.Color(ka).lerp(new THREE.Color(kb), t)
  return {
    elev: lerp(a.elev, b.elev, t),
    azim: lerp(a.azim, b.azim, t),
    sun: col(a.sun, b.sun),
    sunI: lerp(a.sunI, b.sunI, t),
    hemi: lerp(a.hemi, b.hemi, t),
    amb: lerp(a.amb, b.amb, t),
    zenith: col(a.zenith, b.zenith),
    horizon: col(a.horizon, b.horizon),
    ground: col(a.ground, b.ground),
    stars: lerp(a.stars, b.stars, t),
    glow: lerp(a.glow, b.glow, t),
    exposure: lerp(a.exposure, b.exposure, t),
  }
}

/* ------------------------------------------------------------------ */
/* camera presets                                                      */
/* ------------------------------------------------------------------ */

export const VIEWS = [
  { id: 'aerial', name: 'Aerial', blurb: 'Straight down over the lot — footprint, drive, pool and lake frontage.',
    pos: [0.01, 132, 6], target: [0, 0, 2] },
  { id: 'curb', name: 'Curb appeal', blurb: 'From the street, the way the listing photo would frame it.',
    pos: [36, 25, 99], target: [0, 11, 14] },
  { id: 'lake', name: 'Lakeside', blurb: 'From over the water, looking back at the pool and master balcony.',
    pos: [-31, 26, -97], target: [-2, 12, -17] },
  { id: 'pool', name: 'Pool deck', blurb: 'From the water\'s edge, across the pool to the rear elevation.',
    pos: [11, 8, -49], target: [-2, 11, -17] },
  { id: 'entry', name: 'Front entry', blurb: 'Close on the two-story vaulted entry and garage.',
    pos: [20, 9, 54], target: [3, 12, 20] },
  { id: 'plan', name: 'Site plan', blurb: 'Angled overview of the whole lot in context.',
    pos: [74, 70, 92], target: [0, 7, -2] },
]

/* ------------------------------------------------------------------ */
/* scene                                                               */
/* ------------------------------------------------------------------ */

export function createHouseScene(THREE, container, options = {}) {
  const M = model
  const H = M.house

  /* ---------------- renderer / camera ---------------- */

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 600)
  configureRenderer(THREE, renderer)
  container.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.touchAction = 'none'

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(46, (container.clientWidth || 800) / (container.clientHeight || 600), 0.5, 2200)
  camera.position.set(62, 62, 78)

  const controls = createOrbitControls(THREE, camera, renderer.domElement, {
    minDistance: 14,
    maxDistance: 380,
  })
  controls.target.set(0, 6, 0)

  /* ---------------- sky + environment ---------------- */

  const SKY_W = 1024
  const SKY_H = 512
  const skyCanvas = document.createElement('canvas')
  skyCanvas.width = SKY_W
  skyCanvas.height = SKY_H
  const skyCtx = skyCanvas.getContext('2d')
  const skyTex = new THREE.Texture(skyCanvas)
  skyTex.mapping = THREE.EquirectangularReflectionMapping
  setColorTexture(THREE, skyTex)
  scene.background = skyTex

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader?.()
  let envRT = null

  /* ---------------- lights ---------------- */

  const sun = new THREE.DirectionalLight(0xffffff, 3)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const sc = sun.shadow.camera
  sc.left = -125
  sc.right = 125
  sc.top = 125
  sc.bottom = -125
  sc.near = 20
  sc.far = 620
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.06
  scene.add(sun)
  scene.add(sun.target)

  const hemi = new THREE.HemisphereLight(0xbdd8f5, 0x8a7a5e, 0.8)
  scene.add(hemi)
  const ambient = new THREE.AmbientLight(0xffffff, 0.25)
  scene.add(ambient)

  /* ---------------- materials ---------------- */

  const stuccoMap = stuccoTexture(THREE, '#e9dcc4', [0.09, 0.09])
  const stuccoBumpMap = stuccoBump(THREE, [0.09, 0.09])
  const trimMap = stuccoTexture(THREE, '#f3ece0', [0.16, 0.16])

  const mat = {
    stucco: new THREE.MeshStandardMaterial({
      map: stuccoMap, bumpMap: stuccoBumpMap, bumpScale: 0.4,
      color: 0xdccbac, roughness: 0.93, metalness: 0,
    }),
    stuccoAccent: new THREE.MeshStandardMaterial({
      map: stuccoMap, bumpMap: stuccoBumpMap, bumpScale: 0.3,
      color: 0xcbb495, roughness: 0.94, metalness: 0,
    }),
    trim: new THREE.MeshStandardMaterial({ map: trimMap, color: 0xeee5d5, roughness: 0.85, metalness: 0 }),
    roof: new THREE.MeshStandardMaterial({
      map: roofTileTexture(THREE, [0.42, 0.42]),
      bumpMap: roofTileBump(THREE, [0.42, 0.42]),
      bumpScale: 0.5,
      roughness: 0.86, metalness: 0,
    }),
    fascia: new THREE.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.8 }),
    soffit: new THREE.MeshStandardMaterial({ color: 0xded3bf, roughness: 0.95 }),
    garageDoor: new THREE.MeshStandardMaterial({ color: 0xe6ddcc, roughness: 0.55, metalness: 0.12 }),
    frontDoor: new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.5, metalness: 0.05 }),
    concrete: new THREE.MeshStandardMaterial({ map: concreteTexture(THREE, [0.1, 0.1], '#b9b2a4'), roughness: 0.95 }),
    poolDeck: new THREE.MeshStandardMaterial({ map: concreteTexture(THREE, [0.12, 0.12], '#c6bdac'), roughness: 0.9 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x3c3c40, roughness: 0.97 }),
    gravel: new THREE.MeshStandardMaterial({ map: gravelTexture(THREE, [0.16, 0.16]), roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ map: grassTexture(THREE, [0.2, 0.2]), roughness: 1 }),
    plaster: new THREE.MeshStandardMaterial({ map: poolPlasterTexture(THREE, [0.15, 0.15]), roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2b2b2f, roughness: 0.45, metalness: 0.75 }),
    wroughtIron: new THREE.MeshStandardMaterial({ color: 0x40382f, roughness: 0.55, metalness: 0.55 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x7d6247, roughness: 0.95 }),
    frond: new THREE.MeshStandardMaterial({ color: 0x4e7a3a, roughness: 0.85, side: THREE.DoubleSide }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x3f6b34, roughness: 0.95, flatShading: true }),
    rock: new THREE.MeshStandardMaterial({ color: 0x8d7a63, roughness: 1, flatShading: true }),
  }

  const waterNormal = waterNormalTexture(THREE, [4, 4])
  const waterNormal2 = waterNormalTexture(THREE, [9, 9])

  mat.poolWater = new THREE.MeshStandardMaterial({
    color: 0x0d7fa2, roughness: 0.035, metalness: 0.02,
    normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35),
    transparent: true, opacity: 0.86, envMapIntensity: 1.4,
  })
  mat.lakeWater = new THREE.MeshStandardMaterial({
    color: 0x244f63, roughness: 0.055, metalness: 0.05,
    normalMap: waterNormal2, normalScale: new THREE.Vector2(0.55, 0.55),
    transparent: true, opacity: 0.94, envMapIntensity: 1.8,
  })

  // Three glass variants so lit windows don't all read identically at night.
  const glassMats = [0x2a3b47, 0x30414d, 0x263540].map((c) =>
    new THREE.MeshStandardMaterial({
      color: c, roughness: 0.06, metalness: 0.25,
      emissive: new THREE.Color(0xffcf87), emissiveIntensity: 0,
      envMapIntensity: 1.6,
    }),
  )
  const emissiveMats = [...glassMats]

  mat.poolLight = new THREE.MeshStandardMaterial({
    color: 0x0a2a36, emissive: new THREE.Color(0x63d8ff), emissiveIntensity: 0,
  })
  emissiveMats.push(mat.poolLight)
  mat.pathLight = new THREE.MeshStandardMaterial({
    color: 0x2a2a2e, emissive: new THREE.Color(0xffc978), emissiveIntensity: 0,
  })
  emissiveMats.push(mat.pathLight)

  /* ---------------- geometry helpers ---------------- */

  const root = new THREE.Group()
  scene.add(root)

  function addBox(parent, w, h, d, material, x, y, z, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    m.position.set(x, y, z)
    m.castShadow = opts.cast !== false
    m.receiveShadow = opts.receive !== false
    parent.add(m)
    return m
  }

  /** Box specified by its extents, which is how the massing is written down. */
  function addSlab(parent, x0, x1, y0, y1, z0, z1, material, opts) {
    return addBox(parent, x1 - x0, y1 - y0, z1 - z0, material,
      (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, opts)
  }

  function addPlane(parent, w, d, material, x, y, z, opts = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, y, z)
    m.receiveShadow = opts.receive !== false
    m.castShadow = false
    parent.add(m)
    return m
  }

  /**
   * A window or glazed door: recessed glass behind a stucco pop-out surround.
   * `axis` is the wall's normal axis, `sign` which way it faces, `plane` the
   * wall coordinate and `u` the position along the wall.
   */
  function addWindow(parent, { axis, sign, plane, u, y, w, h, arch = false, door = false, variant = 0 }) {
    const g = new THREE.Group()
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMats[variant % glassMats.length])
    glass.position.set(0, 0, -0.3)
    g.add(glass)

    const t = 0.42 // surround thickness
    const p = 0.16 // how far it pops out of the wall
    const surround = mat.trim
    const bar = (bw, bh, bx, by) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.55), surround)
      m.position.set(bx, by, -0.05)
      m.castShadow = true
      m.receiveShadow = true
      g.add(m)
    }
    bar(w + t * 2, t, 0, h / 2 + t / 2)
    bar(w + t * 2, t, 0, -h / 2 - t / 2)
    bar(t, h, -w / 2 - t / 2, 0)
    bar(t, h, w / 2 + t / 2, 0)

    if (arch) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(w / 2 + t / 2, t / 2, 6, 24, Math.PI),
        surround,
      )
      ring.position.set(0, h / 2 + t, -0.05)
      ring.castShadow = true
      g.add(ring)
      const fan = new THREE.Mesh(
        new THREE.CircleGeometry(w / 2, 20, 0, Math.PI),
        glassMats[variant % glassMats.length],
      )
      fan.position.set(0, h / 2 + t, -0.3)
      g.add(fan)
    }

    // Mullions: one vertical for windows, two for a slider/French door.
    const mull = door ? [-w / 6, w / 6] : [0]
    for (const mx of mull) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.2), surround)
      m.position.set(mx, 0, -0.22)
      g.add(m)
    }
    if (!door && h > 3.2) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.2), surround)
      m.position.set(0, 0, -0.22)
      g.add(m)
    }

    if (axis === 'z') {
      g.position.set(u, y + h / 2, plane + sign * p)
      if (sign < 0) g.rotation.y = Math.PI
    } else {
      g.position.set(plane + sign * p, y + h / 2, u)
      g.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2
    }
    parent.add(g)
    return g
  }

  /** Hip or gable roof mesh plus the fascia band that closes off the eave. */
  function addRoof(parent, { type = 'hip', w, d, pitch, x, y, z, rotY = 0 }) {
    const g = new THREE.Group()
    const geo = type === 'hip'
      ? hipRoofGeometry(THREE, w, d, pitch)
      : gableRoofGeometry(THREE, w, d, pitch)
    const roof = new THREE.Mesh(geo, mat.roof)
    roof.castShadow = true
    roof.receiveShadow = true
    g.add(roof)

    // Fascia: a thin slab at the eave line reading as the sub-fascia board.
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), mat.fascia)
    f.position.y = -0.25
    f.castShadow = true
    f.receiveShadow = true
    g.add(f)

    // Soffit underside.
    const s = new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, 0.08, d - 0.05), mat.soffit)
    s.position.y = -0.5
    s.receiveShadow = true
    g.add(s)

    g.position.set(x, y, z)
    g.rotation.y = rotY
    parent.add(g)
    g.userData.rise = geo.userData.rise
    return g
  }

  /** Sloped slab used for the porch/garage roof strips. */
  function addShedRoof(parent, { x0, x1, z0, z1, yLow, yHigh }) {
    const w = x1 - x0
    const d = z1 - z0
    const rise = yHigh - yLow
    const len = Math.hypot(d, rise)
    const geo = new THREE.PlaneGeometry(w, len)
    const m = new THREE.Mesh(geo, mat.roof)
    m.rotation.x = -Math.PI / 2 + Math.atan2(rise, d)
    m.position.set((x0 + x1) / 2, (yLow + yHigh) / 2, (z0 + z1) / 2)
    m.castShadow = true
    m.receiveShadow = true
    // Tile texture is measured in feet, so scale UVs by real size.
    const uv = geo.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * len)
    uv.needsUpdate = true
    parent.add(m)

    const f = addSlab(parent, x0, x1, yLow - 0.5, yLow, z1 - 0.4, z1, mat.fascia)
    f.castShadow = true
    return m
  }

  /* ---------------- site ---------------- */

  const site = new THREE.Group()
  root.add(site)

  const halfLotW = M.lot.width / 2
  const frontLot = M.lot.depth / 2
  const rearLot = -M.lot.depth / 2

  // Neighbourhood ground plane. It stops at the rear lot line so it cannot
  // cover the lake surface, which sits below grade.
  addPlane(site, 900, 440, mat.gravel, 0, -0.12, rearLot + 220)

  // The lot itself.
  addPlane(site, M.lot.width, M.lot.depth, mat.gravel, 0, 0, 0)

  // Street, curb and sidewalk on the +Z side.
  addPlane(site, 420, M.street.farZ - M.street.curbZ, mat.asphalt, 0, -0.02, (M.street.curbZ + M.street.farZ) / 2)
  addSlab(site, -210, 210, -0.02, 0.42, M.street.curbZ, M.street.curbZ + 0.6, mat.concrete, { cast: false })
  addPlane(site, 420, 4.5, mat.concrete, 0, 0.04, M.street.curbZ - 2.6)
  // Grass parkway between sidewalk and property line.
  addPlane(site, 420, M.street.curbZ - 4.9 - frontLot, mat.grass, 0, 0.02, (frontLot + M.street.curbZ - 4.9) / 2)

  // Driveway from the curb cut to the garage door.
  const drv = M.driveway
  addPlane(site, drv.width, M.street.curbZ - H.frontZ, mat.concrete, drv.centerX, 0.05, (H.frontZ + M.street.curbZ) / 2)

  // Front walk from the driveway to the entry.
  addPlane(site, 4, 9, mat.concrete, 3.5, 0.06, M.street.curbZ - 8)
  addPlane(site, 12, 4, mat.concrete, 3, 0.06, M.entry.z1 + 2.6)

  // Rear yard: pool deck, lawn panels, lake walkway.
  const patioZ = H.rearZ - M.patio.projection
  addPlane(site, M.lot.width - 1, Math.abs(patioZ - (rearLot + 3)), mat.poolDeck, 0, 0.05,
    (patioZ + rearLot + 3) / 2)
  addPlane(site, 9, 16, mat.grass, -14.5, 0.07, -26)
  addPlane(site, 8, 16, mat.grass, 15, 0.07, -26)

  /* ---------------- pool ---------------- */

  const pool = new THREE.Group()
  site.add(pool)
  const poolShape = roundedRectShape(THREE, M.pool.width, M.pool.length, 2.2)
  const shellGeo = new THREE.ExtrudeGeometry(poolShape, {
    depth: M.pool.depth, bevelEnabled: false, curveSegments: 12,
  })
  shellGeo.rotateX(Math.PI / 2)
  const shell = new THREE.Mesh(shellGeo, mat.plaster)
  shell.material.side = THREE.BackSide
  shell.position.set(M.pool.centerX, 0.02, M.pool.centerZ)
  shell.receiveShadow = true
  pool.add(shell)

  // Waterline tile band.
  const bandGeo = new THREE.ExtrudeGeometry(poolShape, { depth: 0.7, bevelEnabled: false, curveSegments: 12 })
  bandGeo.rotateX(Math.PI / 2)
  const band = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ color: 0x2f7fa8, roughness: 0.25, metalness: 0.1, side: THREE.BackSide }))
  band.position.set(M.pool.centerX, 0.01, M.pool.centerZ)
  pool.add(band)

  // Coping.
  const copeShape = roundedRectShape(THREE, M.pool.width + 1.4, M.pool.length + 1.4, 2.9)
  copeShape.holes.push(roundedRectShape(THREE, M.pool.width, M.pool.length, 2.2))
  const cope = new THREE.Mesh(
    new THREE.ExtrudeGeometry(copeShape, { depth: 0.35, bevelEnabled: false, curveSegments: 12 }),
    new THREE.MeshStandardMaterial({ color: 0xe4dbc8, roughness: 0.8 }),
  )
  cope.rotation.x = -Math.PI / 2
  cope.position.set(M.pool.centerX, 0.4, M.pool.centerZ)
  cope.receiveShadow = true
  cope.castShadow = true
  pool.add(cope)

  const poolSurface = new THREE.Mesh(
    new THREE.ShapeGeometry(roundedRectShape(THREE, M.pool.width - 0.1, M.pool.length - 0.1, 2.2), 12),
    mat.poolWater,
  )
  poolSurface.rotation.x = -Math.PI / 2
  poolSurface.position.set(M.pool.centerX, 0.22, M.pool.centerZ)
  poolSurface.receiveShadow = true
  pool.add(poolSurface)

  // Two pool lights in the shell wall.
  for (const px of [-6, 6]) {
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), mat.poolLight)
    l.position.set(M.pool.centerX + px, -1.4, M.pool.centerZ + M.pool.length / 2 - 0.06)
    l.rotation.y = Math.PI
    pool.add(l)
  }

  /* ---------------- lake ---------------- */

  const lake = new THREE.Group()
  site.add(lake)
  const lakeSurface = new THREE.Mesh(new THREE.PlaneGeometry(760, Math.abs(M.lake.farZ - M.lake.nearZ), 1, 1), mat.lakeWater)
  lakeSurface.rotation.x = -Math.PI / 2
  lakeSurface.position.set(0, -0.55, (M.lake.nearZ + M.lake.farZ) / 2)
  lakeSurface.receiveShadow = true
  lake.add(lakeSurface)

  // Bank between the rear lot line and the water, plus a rip-rap edge.
  addSlab(lake, -380, 380, -2.4, 0.2, M.lake.nearZ, rearLot, mat.gravel, { cast: false })
  for (let i = 0; i < 90; i++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + Math.random() * 1.1, 0), mat.rock)
    r.position.set(-190 + Math.random() * 380, -0.2 + Math.random() * 0.5, M.lake.nearZ + Math.random() * 3)
    r.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    r.castShadow = true
    r.receiveShadow = true
    lake.add(r)
  }

  // Far shore.
  addSlab(lake, -380, 380, -1.2, 1.6, M.lake.farZ - 170, M.lake.farZ, mat.grass, { cast: false })

  // Lake walkway and a view fence at the rear lot line, kept low for the view.
  addPlane(site, M.lot.width - 2, 4, mat.concrete, 0, 0.08, rearLot + 2)
  const fence = new THREE.Group()
  site.add(fence)
  for (let x = -halfLotW + 1.2; x <= halfLotW - 1.2; x += 1.15) {
    addBox(fence, 0.08, 3.4, 0.08, mat.wroughtIron, x, 1.7, rearLot, { receive: false })
  }
  for (const [ry, rt] of [[3.4, 0.13], [0.35, 0.1]]) {
    addBox(fence, M.lot.width - 2, rt, rt, mat.wroughtIron, 0, ry, rearLot, { receive: false })
  }
  for (const sx of [-1, 1]) {
    addBox(fence, 0.22, 3.9, 0.22, mat.wroughtIron, sx * (halfLotW - 1), 1.95, rearLot, { receive: false })
  }

  // Side property walls (zero lot line block walls).
  for (const sx of [-1, 1]) {
    addSlab(site, sx * halfLotW - 0.3, sx * halfLotW + 0.3, 0, 5, rearLot + 5, H.frontZ - 4, mat.stuccoAccent)
    // Wall steps down to 3 ft over the last few feet so the view opens up.
    addSlab(site, sx * halfLotW - 0.3, sx * halfLotW + 0.3, 0, 3, rearLot, rearLot + 5, mat.stuccoAccent)
  }

  /* ---------------- house ---------------- */

  const house = new THREE.Group()
  root.add(house)

  const y1 = H.floor1Height
  const y2 = y1 + H.floor2Height
  const hw = H.halfWidth

  // First floor mass.
  addSlab(house, -hw, hw, 0, y1, H.rearZ, H.frontZ, mat.stucco)
  // Second floor mass, inset front and rear.
  addSlab(house, -hw, hw, y1, y2, H.floor2RearZ, H.floor2FrontZ, mat.stucco)

  // Two-story entry element projecting past the front wall.
  const E = M.entry
  addSlab(house, E.x0, E.x1, 0, E.height, E.z0, E.z1, mat.stucco)

  // Ground-floor roof strips exposed by the second-floor inset.
  addShedRoof(house, {
    x0: -hw - H.roofOverhang, x1: E.x0 - 0.2,
    z0: H.floor2FrontZ, z1: H.frontZ + H.roofOverhang,
    yLow: y1 - 0.4, yHigh: y1 + 1.6,
  })
  addShedRoof(house, {
    x0: E.x1 + 0.2, x1: hw + H.roofOverhang,
    z0: H.floor2FrontZ, z1: H.frontZ + H.roofOverhang,
    yLow: y1 - 0.4, yHigh: y1 + 1.6,
  })

  // Rear balcony deck sits on the first-floor roof left by the same inset.
  addSlab(house, -hw, hw, y1 - 0.35, y1 + 0.15, H.rearZ, H.floor2RearZ,
    new THREE.MeshStandardMaterial({ color: 0xd8cdb6, roughness: 0.9 }))

  const balconyRail = new THREE.Group()
  house.add(balconyRail)
  const railY = y1 + 0.15
  for (let x = -hw + 0.5; x <= hw - 0.5; x += 1.05) {
    addBox(balconyRail, 0.11, 3.2, 0.11, mat.wroughtIron, x, railY + 1.6, H.rearZ + 0.3, { receive: false })
  }
  for (const zz of [H.rearZ + 0.3]) {
    addBox(balconyRail, M.lot.width - 4, 0.18, 0.24, mat.wroughtIron, 0, railY + 3.2, zz, { receive: false })
    addBox(balconyRail, M.lot.width - 4, 0.13, 0.13, mat.wroughtIron, 0, railY + 0.5, zz, { receive: false })
  }
  // Returns along the sides of the deck.
  for (const sx of [-1, 1]) {
    for (let z = H.rearZ + 0.9; z <= H.floor2RearZ; z += 1.05) {
      addBox(balconyRail, 0.09, 3.2, 0.09, mat.wroughtIron, sx * (hw - 0.4), railY + 1.6, z, { receive: false })
    }
    addBox(balconyRail, 0.18, 0.18, Math.abs(H.floor2RearZ - H.rearZ), mat.wroughtIron,
      sx * (hw - 0.4), railY + 3.2, (H.rearZ + H.floor2RearZ) / 2, { receive: false })
  }

  // Main hip roof over the second floor.
  const roofW = 2 * hw + 2 * H.roofOverhang
  const roofD = Math.abs(H.floor2FrontZ - H.floor2RearZ) + 2 * H.roofOverhang
  addRoof(house, {
    type: 'hip', w: roofW, d: roofD, pitch: H.roofPitch,
    x: 0, y: y2, z: (H.floor2FrontZ + H.floor2RearZ) / 2,
  })

  // Gable roof over the entry element.
  addRoof(house, {
    type: 'gable', w: (E.x1 - E.x0) + 3, d: (E.z1 - E.z0) + 1.5, pitch: E.pitch,
    x: (E.x0 + E.x1) / 2, y: E.height, z: (E.z0 + E.z1) / 2,
  })

  // Chimney chase for the fireplace, on the west elevation.
  addSlab(house, -hw - 1.6, -hw + 0.6, 0, y2 + 7.5, -2.5, 2.5, mat.stucco)
  addSlab(house, -hw - 2.1, -hw + 1.1, y2 + 7.5, y2 + 8.4, -3, 3, mat.trim)

  /* ---------------- openings ---------------- */

  // Garage: recessed door with a header pop-out.
  const GD = M.garageDoor
  addSlab(house, GD.x0, GD.x1, 0, GD.height, H.frontZ - 0.35, H.frontZ - 0.1, mat.garageDoor)
  for (let py = 0.55; py < GD.height - 0.2; py += 1.75) {
    addSlab(house, GD.x0 + 0.1, GD.x1 - 0.1, py, py + 0.12, H.frontZ - 0.11, H.frontZ - 0.02, mat.trim, { receive: false })
  }
  addSlab(house, GD.x0 - 0.5, GD.x1 + 0.5, GD.height, GD.height + 0.55, H.frontZ - 0.1, H.frontZ + 0.2, mat.trim)
  addSlab(house, GD.x0 - 0.5, GD.x0, 0, GD.height + 0.55, H.frontZ - 0.1, H.frontZ + 0.2, mat.trim)
  addSlab(house, GD.x1, GD.x1 + 0.5, 0, GD.height + 0.55, H.frontZ - 0.1, H.frontZ + 0.2, mat.trim)

  // Front door inside the entry element.
  addSlab(house, 5.4, 8.6, 0, 8, E.z1 - 0.35, E.z1 - 0.1, mat.frontDoor)
  addWindow(house, { axis: 'z', sign: 1, plane: E.z1, u: 7, y: 11, w: 4.6, h: 5.5, arch: true, variant: 1 })

  // Front elevation glazing.
  addWindow(house, { axis: 'z', sign: 1, plane: H.frontZ, u: 15, y: 2.6, w: 5, h: 5.4, variant: 0 })
  addWindow(house, { axis: 'z', sign: 1, plane: H.floor2FrontZ, u: -13, y: y1 + 2.4, w: 4.4, h: 4.4, variant: 2 })
  addWindow(house, { axis: 'z', sign: 1, plane: H.floor2FrontZ, u: -5, y: y1 + 2.4, w: 4.4, h: 4.4, variant: 0 })
  addWindow(house, { axis: 'z', sign: 1, plane: H.floor2FrontZ, u: 15, y: y1 + 2.4, w: 4.4, h: 4.4, variant: 1 })

  // Rear elevation: slider to the covered patio, master doors to the balcony.
  addWindow(house, { axis: 'z', sign: -1, plane: H.rearZ, u: -5, y: 0.4, w: 10, h: 7.4, door: true, variant: 1 })
  addWindow(house, { axis: 'z', sign: -1, plane: H.rearZ, u: 8, y: 2.6, w: 5.4, h: 5.2, variant: 0 })
  addWindow(house, { axis: 'z', sign: -1, plane: H.floor2RearZ, u: -3, y: y1 + 1.4, w: 9, h: 7, door: true, variant: 2 })
  addWindow(house, { axis: 'z', sign: -1, plane: H.floor2RearZ, u: 10, y: y1 + 2.6, w: 5, h: 4.6, variant: 0 })
  addWindow(house, { axis: 'z', sign: -1, plane: H.floor2RearZ, u: -13, y: y1 + 2.6, w: 4.4, h: 4.6, variant: 1 })

  // Side elevations.
  addWindow(house, { axis: 'x', sign: 1, plane: hw, u: -8, y: 2.6, w: 4.4, h: 5, variant: 2 })
  addWindow(house, { axis: 'x', sign: 1, plane: hw, u: 6, y: 2.6, w: 3.4, h: 5, variant: 0 })
  addWindow(house, { axis: 'x', sign: 1, plane: hw, u: -4, y: y1 + 2.6, w: 3.8, h: 4.4, variant: 1 })
  addWindow(house, { axis: 'x', sign: 1, plane: hw, u: 8, y: y1 + 2.6, w: 3.8, h: 4.4, variant: 2 })
  addWindow(house, { axis: 'x', sign: -1, plane: -hw, u: -10, y: 2.6, w: 3.6, h: 5, variant: 0 })
  addWindow(house, { axis: 'x', sign: -1, plane: -hw, u: -6, y: y1 + 2.6, w: 3.6, h: 4.4, variant: 2 })

  /* ---------------- covered patio ---------------- */

  const patio = new THREE.Group()
  house.add(patio)
  const P = M.patio
  const patioMat = new THREE.MeshStandardMaterial({
    map: stuccoMap, bumpMap: stuccoBumpMap, bumpScale: 0.3, color: 0xcbba9c, roughness: 0.92,
  })
  addSlab(patio, P.x0, P.x1, P.height, P.height + 0.6, patioZ, H.rearZ, patioMat)
  // Exposed rafter tails under the cover.
  for (let z = patioZ; z < H.rearZ; z += 2.2) {
    addSlab(patio, P.x0 + 0.3, P.x1 - 0.3, P.height - 0.45, P.height, z, z + 0.55, patioMat)
  }
  for (const px of [P.x0 + 0.6, P.x1 - 0.6]) {
    addBox(patio, 0.85, P.height, 0.85, patioMat, px, P.height / 2, patioZ + 0.5)
  }
  addPlane(patio, P.x1 - P.x0, P.projection, mat.poolDeck, (P.x0 + P.x1) / 2, 0.1, (patioZ + H.rearZ) / 2)

  /* ---------------- neighbours ---------------- */

  function neighbour(offsetX, colour, frontZ, depth, height2) {
    const g = new THREE.Group()
    const m = new THREE.MeshStandardMaterial({
      map: stuccoMap, bumpMap: stuccoBumpMap, bumpScale: 0.3, color: colour, roughness: 0.93,
    })
    const w = 31
    addSlab(g, -w / 2, w / 2, 0, 10, frontZ - depth, frontZ, m)
    addSlab(g, -w / 2, w / 2, 10, 19, frontZ - depth + 6, frontZ - 4, m)
    addRoof(g, {
      type: 'hip', w: w + 4, d: depth - 6, pitch: H.roofPitch,
      x: 0, y: height2, z: frontZ - depth / 2 + 1,
    })
    for (let i = 0; i < 4; i++) {
      addWindow(g, { axis: 'z', sign: 1, plane: frontZ, u: -12 + i * 8, y: 2.6, w: 3.6, h: 4.6, variant: i % 3 })
      addWindow(g, { axis: 'z', sign: -1, plane: frontZ - depth, u: -12 + i * 8, y: 2.6, w: 3.6, h: 4.6, variant: i % 3 })
    }
    g.position.x = offsetX
    root.add(g)
    return g
  }
  neighbour(-M.lot.width, 0xc9b795, H.frontZ + 2, 34, 18)
  neighbour(M.lot.width, 0xd3c4a6, H.frontZ - 3, 36, 18.5)
  neighbour(-M.lot.width * 2, 0xbfae8d, H.frontZ + 5, 33, 18.5)
  neighbour(M.lot.width * 2, 0xcec19f, H.frontZ - 1, 35, 18)

  /* ---------------- landscaping ---------------- */

  const plants = new THREE.Group()
  root.add(plants)

  function palm(x, z, height, tilt = 0) {
    const g = new THREE.Group()
    const seg = 8
    const pts = []
    for (let i = 0; i <= seg; i++) {
      const t = i / seg
      pts.push(new THREE.Vector2(0.85 - 0.35 * t, t * height))
    }
    const trunk = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), mat.trunk)
    trunk.castShadow = true
    g.add(trunk)
    for (let i = 0; i < 17; i++) {
      const a = (i / 17) * Math.PI * 2 + Math.random() * 0.15
      const droop = 0.5 + Math.random() * 0.5
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 1.25, 6, 1), mat.frond)
      const pos = frond.geometry.attributes.position
      for (let v = 0; v < pos.count; v++) {
        const px = pos.getX(v)
        const t = (px + 4.75) / 9.5
        pos.setZ(v, -Math.pow(t, 2) * 5.2 * droop)
        pos.setY(v, pos.getY(v) * (1 - t * 0.75))
      }
      pos.needsUpdate = true
      frond.geometry.computeVertexNormals()
      frond.geometry.translate(4.75, 0, 0)
      frond.position.set(0, height - 0.3, 0)
      frond.rotation.y = a
      frond.rotation.z = 0.16 - Math.random() * 0.55
      frond.castShadow = true
      g.add(frond)
    }
    g.position.set(x, 0, z)
    g.rotation.z = tilt
    plants.add(g)
    return g
  }

  function shrub(x, z, r, colour = 0x3f6b34) {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.95, flatShading: true }),
    )
    m.position.set(x, r * 0.75, z)
    m.scale.y = 0.8 + Math.random() * 0.3
    m.rotation.y = Math.random() * 3
    m.castShadow = true
    m.receiveShadow = true
    plants.add(m)
    return m
  }

  function tree(x, z, h, r) {
    const g = new THREE.Group()
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, h, 8), mat.trunk)
    trunk.position.y = h / 2
    trunk.castShadow = true
    g.add(trunk)
    for (let i = 0; i < 4; i++) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.7 + Math.random() * 0.5), 1), mat.foliage)
      blob.position.set((Math.random() - 0.5) * r, h + (Math.random() - 0.3) * r * 0.7, (Math.random() - 0.5) * r)
      blob.castShadow = true
      g.add(blob)
    }
    g.position.set(x, 0, z)
    plants.add(g)
    return g
  }

  function agave(x, z, r) {
    const g = new THREE.Group()
    const m = new THREE.MeshStandardMaterial({ color: 0x7d9b6a, roughness: 0.8, side: THREE.DoubleSide, flatShading: true })
    for (let i = 0; i < 12; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, r * 2.2, 4), m)
      leaf.position.y = r * 0.9
      leaf.rotation.z = (Math.random() * 0.4 + 0.55) * (i % 2 ? 1 : -1)
      leaf.rotation.y = (i / 12) * Math.PI * 2
      leaf.castShadow = true
      const holder = new THREE.Group()
      holder.rotation.y = (i / 12) * Math.PI * 2
      holder.add(leaf)
      g.add(holder)
    }
    g.position.set(x, 0, z)
    g.scale.setScalar(0.85 + Math.random() * 0.4)
    plants.add(g)
    return g
  }

  function boulder(x, z, r) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat.rock)
    m.position.set(x, r * 0.45, z)
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    m.scale.set(1, 0.7, 0.9)
    m.castShadow = true
    m.receiveShadow = true
    plants.add(m)
    return m
  }

  // Front yard: the "luscious landscaping" the listing leads with.
  palm(-18.5, 31, 17)
  palm(18.2, 35, 20, 0.03)
  tree(-16.5, 37.5, 6.5, 3.2)
  for (const [sx, sz, r] of [[-3, 29, 1.4], [0.5, 30.5, 1.1], [14, 25, 1.3], [16.5, 28.5, 1.0], [-13.5, 26, 1.2]]) {
    shrub(sx, sz, r, 0x4a7a3c)
  }
  agave(-6, 31, 1.5)
  agave(17, 24, 1.3)
  boulder(-15, 30, 1.8)
  boulder(10, 34, 1.3)
  addPlane(site, 12, 5, mat.grass, -3, 0.03, 32)

  // Rear yard: pool-side planting and a pair of palms against the lake.
  palm(-17.5, -34, 19, -0.02)
  palm(17.5, -37, 22)
  palm(18.5, -19, 15, 0.06)
  tree(-15, -20, 6.5, 3.6)
  for (const [sx, sz, r] of [[-17, -28, 1.4], [17, -30, 1.5], [-16, -32, 1.1], [16, -25, 1.2], [12, -38, 1.3], [-11, -38.5, 1.2]]) {
    shrub(sx, sz, r, 0x44713a)
  }
  agave(-13, -34, 1.4)
  boulder(14, -34, 1.5)
  boulder(-14, -24, 1.2)

  // Path lights along the front walk and the lake walkway.
  for (const [lx, lz] of [[1.2, 34], [1.2, 30], [5.5, 26.5], [-8, -38.5], [0, -38.5], [8, -38.5]]) {
    const post = addBox(plants, 0.18, 2.4, 0.18, mat.metal, lx, 1.2, lz, { receive: false })
    post.castShadow = false
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 10), mat.pathLight)
    head.position.set(lx, 2.4, lz)
    plants.add(head)
  }

  // Street furniture: mailbox at the curb.
  addBox(site, 0.32, 3.6, 0.32, mat.metal, drv.centerX + 11, 1.8, M.street.curbZ - 3.6, { receive: false })
  addBox(site, 1.5, 0.9, 0.9, mat.metal, drv.centerX + 11, 3.9, M.street.curbZ - 3.6, { receive: false })

  // Distant palms across the lake for depth.
  for (let i = 0; i < 26; i++) {
    const g = palm(-260 + Math.random() * 520, M.lake.farZ - 6 - Math.random() * 90, 14 + Math.random() * 10)
    g.traverse((o) => { o.castShadow = false })
  }

  /* ---------------- labels ---------------- */

  const labelGroup = new THREE.Group()
  root.add(labelGroup)

  function label(text, x, y, z) {
    const pad = 24
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    ctx.font = 'bold 44px system-ui, sans-serif'
    const w = ctx.measureText(text).width
    c.width = w + pad * 2
    c.height = 96
    const ctx2 = c.getContext('2d')
    ctx2.font = 'bold 44px system-ui, sans-serif'
    ctx2.fillStyle = 'rgba(12,16,24,0.72)'
    ctx2.beginPath()
    if (ctx2.roundRect) ctx2.roundRect(0, 16, c.width, 64, 22)
    else ctx2.rect(0, 16, c.width, 64)
    ctx2.fill()
    ctx2.fillStyle = '#ffffff'
    ctx2.textBaseline = 'middle'
    ctx2.fillText(text, pad, 49)
    const tex = new THREE.CanvasTexture(c)
    setColorTexture(THREE, tex)
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
    spr.scale.set(c.width / 96 * 5, 5, 1)
    spr.position.set(x, y, z)
    spr.renderOrder = 10
    labelGroup.add(spr)
    return spr
  }

  label('Street / front', 0, 8, M.street.curbZ - 6)
  label('3-car garage', GD.x0 + 8, 12, H.frontZ + 6)
  label('Vaulted entry', 7, 25, E.z1 + 4)
  label('Pool', M.pool.centerX, 6, M.pool.centerZ)
  label('Master balcony', 0, y1 + 8, H.rearZ - 6)
  label('Covered patio', (P.x0 + P.x1) / 2, 3, patioZ - 3)
  label('Lake frontage', 0, 7, rearLot - 8)
  labelGroup.visible = false

  /* ---------------- day cycle ---------------- */

  const sunDir = new THREE.Vector3()
  let envDirty = true
  let lastEnvUpdate = -1

  function applyTimeOfDay(hour) {
    const s = sampleDay(THREE, hour)
    const el = s.elev * DEG
    const az = s.azim * DEG
    // Azimuth 0 = due east (+Z), increasing toward due south (+X).
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize()

    sun.position.copy(sunDir).multiplyScalar(300)
    sun.target.position.set(0, 6, 0)
    sun.color.copy(s.sun)
    sun.intensity = Math.max(0, s.sunI)
    sun.visible = s.sunI > 0.02
    // Below the horizon the "sun" becomes moonlight from the opposite side.
    if (s.elev < 0) {
      sun.position.set(-sunDir.x * 300, 160, -sunDir.z * 300)
      sun.intensity = Math.max(0.08, s.sunI)
    }

    hemi.intensity = s.hemi
    hemi.color.copy(s.zenith).lerp(new THREE.Color(0xffffff), 0.35)
    hemi.groundColor.copy(s.ground)
    ambient.intensity = s.amb
    ambient.color.copy(s.horizon).lerp(new THREE.Color(0xffffff), 0.8)
    renderer.toneMappingExposure = s.exposure

    for (const m of emissiveMats) m.emissiveIntensity = s.glow * (m === mat.poolLight ? 1.6 : 1.0)
    mat.lakeWater.envMapIntensity = 1.4 + s.glow * 1.2

    paintSky(skyCtx, SKY_W, SKY_H, {
      zenith: `#${s.zenith.getHexString()}`,
      horizon: `#${s.horizon.getHexString()}`,
      ground: `#${s.ground.getHexString()}`,
      sunColor: `#${s.sun.getHexString()}`,
      sunAzimuth: Math.atan2(sunDir.z, sunDir.x) + Math.PI,
      sunElevation: Math.asin(Math.max(-1, Math.min(1, sunDir.y))),
      sunIntensity: Math.min(1, s.sunI / 2.4),
      stars: s.stars,
    })
    skyTex.needsUpdate = true
    envDirty = true
  }

  function refreshEnvironment(now) {
    if (!envDirty) return
    // PMREM is cheap at this size but not free; cap it to ~12 Hz.
    if (now - lastEnvUpdate < 80) return
    lastEnvUpdate = now
    envDirty = false
    const next = pmrem.fromEquirectangular(skyTex)
    if (envRT) envRT.dispose()
    envRT = next
    scene.environment = envRT.texture
  }

  /* ---------------- camera fly-to ---------------- */

  const fly = { active: false, t: 0, dur: 1.25, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3() }

  function setView(id, instant = false) {
    const v = VIEWS.find((x) => x.id === id) || VIEWS[0]
    fly.fromPos.copy(camera.position)
    fly.toPos.set(...v.pos)
    fly.fromTgt.copy(controls.target)
    fly.toTgt.set(...v.target)
    if (instant) {
      camera.position.copy(fly.toPos)
      controls.target.copy(fly.toTgt)
      fly.active = false
    } else {
      fly.t = 0
      fly.active = true
    }
    return v
  }

  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

  /* ---------------- loop ---------------- */

  let raf = 0
  let disposed = false
  let lastFrame = performance.now()

  function resize() {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
  ro?.observe(container)
  window.addEventListener('resize', resize)

  function tick() {
    if (disposed) return
    raf = requestAnimationFrame(tick)
    const now = performance.now()
    const dt = Math.min((now - lastFrame) / 1000, 0.05)
    lastFrame = now

    if (fly.active) {
      if (controls.interacting) {
        fly.active = false
      } else {
        fly.t = Math.min(1, fly.t + dt / fly.dur)
        const e = easeInOut(fly.t)
        camera.position.lerpVectors(fly.fromPos, fly.toPos, e)
        controls.target.lerpVectors(fly.fromTgt, fly.toTgt, e)
        if (fly.t >= 1) fly.active = false
      }
    }

    waterNormal.offset.x = (now * 0.000018) % 1
    waterNormal.offset.y = (now * 0.000026) % 1
    waterNormal2.offset.x = (now * 0.0000085) % 1
    waterNormal2.offset.y = (now * -0.0000125 % 1 + 1) % 1

    refreshEnvironment(now)
    controls.update(dt)
    renderer.render(scene, camera)
  }

  applyTimeOfDay(options.hour ?? 15.4)
  setView(options.view ?? 'plan', true)
  resize()
  tick()

  /* ---------------- api ---------------- */

  return {
    scene,
    camera,
    controls,
    renderer,
    views: VIEWS,
    setView,
    setTimeOfDay: applyTimeOfDay,
    setAutoRotate(on) {
      controls.autoRotate = !!on
    },
    setLabels(on) {
      labelGroup.visible = !!on
    },
    resize,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', resize)
      controls.dispose()
      envRT?.dispose()
      pmrem.dispose()
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        const m = o.material
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else if (m) m.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
