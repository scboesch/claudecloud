# 1181 W Redondo Dr — 3D Property Study

An interactive three.js reconstruction of the house at 1181 W Redondo Dr,
Gilbert AZ 85233, in Catalina Bay at The Islands.

The whole model is generated procedurally in code from the public property
record. There are no image assets and no imported meshes: massing, roofs,
windows, pool, landscaping, textures and sky are all built at runtime.

```
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

The original React task-list demo still ships at `/tasks.html`.

## What is and is not real

This is a **data-informed reconstruction, not a survey**. No aerial or
satellite imagery of the property was used — the session that built it had no
network route to any imagery provider — so nothing here is traced from a photo
of the actual roof.

What comes from the record (MLS #6448966 and county data): two stories,
2,719 sq ft, 4 bd / 2.5 ba, built 1993 by Blandford Homes, ~3,245 sq ft lot,
stucco over frame, concrete tile roof, 3 garage spaces, pool, covered patio,
grass area, lake frontage, vaulted entry, fireplace.

What is inferred: the 36 ft × 38 ft footprint (2,719 sq ft over two floors on a
40 ft wide lot), the 40 × 81 lot proportions, the hip roof pitch, and the
tandem third garage bay — a 36 ft facade cannot fit three doors side by side.

What is invented: window and door placement, colours, planting, the chimney
location, and compass orientation. The in-app **How this was built** panel tags
every element as `listed`, `derived`, or `assumed`.

## Layout

| Path | Role |
| --- | --- |
| `src/house/property.js` | Record facts, source links, and every model dimension in feet |
| `src/house/lib.js` | Orbit controls, procedural canvas textures, roof geometry, sky painter |
| `src/house/scene.js` | Builds the site, house, landscaping, lighting and camera presets |
| `src/house/HouseViewer.jsx` | React shell: view presets, time-of-day dial, info panels |

`property.js` is the single source of truth for geometry. Correcting a number
there re-shapes the model — if you learn the real footprint or lot dimensions,
edit that file rather than the scene.

`scene.js` takes the `THREE` namespace as an argument rather than importing it,
so the same scene code runs against the npm package or a CDN global build.

## Notes on the render

- Units are feet, +Y up. Orientation is nominal: the street is treated as east
  and the lake as west, so the sun rises over the front elevation and sets over
  the water.
- The time-of-day dial drives a single keyframe table (`DAY` in `scene.js`)
  covering sun angle and colour, hemisphere and ambient light, exposure, sky
  gradient, star density and the emissive glow on windows and pool lights.
- The sky is painted to an equirectangular canvas each time the light changes
  and used as both the background and, through `PMREMGenerator`, the
  environment map — so the water and glass reflect the same sky you see.
