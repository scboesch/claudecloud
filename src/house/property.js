/**
 * Public-record facts for 1181 W Redondo Dr, Gilbert, AZ 85233.
 *
 * Everything in `facts` comes from public real-estate listings / county
 * records (MLS #6448966). Everything in `model` is a dimensional
 * interpretation built from those facts -- it is a data-informed
 * approximation, not a survey or an as-built drawing.
 */

export const address = {
  street: '1181 W Redondo Dr',
  city: 'Gilbert',
  state: 'AZ',
  zip: '85233',
  subdivision: 'Catalina Bay at The Islands',
}

export const facts = [
  { label: 'Living area', value: '2,719 sq ft' },
  { label: 'Bedrooms / baths', value: '4 bd / 2.5 ba' },
  { label: 'Stories', value: '2' },
  { label: 'Year built', value: '1993' },
  { label: 'Builder / tract', value: 'Blandford Homes, Catalina Bay (1991-94)' },
  { label: 'Lot', value: '0.07 acre (~3,245 sq ft)' },
  { label: 'Construction', value: 'Stucco over frame' },
  { label: 'Roof', value: 'Concrete tile (replaced prior to 2022 sale)' },
  { label: 'Garage', value: '3 spaces' },
  { label: 'Exterior features', value: 'Pool, covered patio, grass area, lake frontage' },
  { label: 'Interior notes', value: 'Vaulted entry, open plan, fireplace, remodeled kitchen' },
  { label: 'Last sale', value: '$760,000 on Sep 13, 2022' },
]

export const sources = [
  { label: 'Zillow', url: 'https://www.zillow.com/homedetails/1181-W-Redondo-Dr-Gilbert-AZ-85233/8204253_zpid/' },
  { label: 'Redfin', url: 'https://www.redfin.com/AZ/Gilbert/1181-W-Redondo-Dr-85233/home/27618147' },
  { label: 'Trulia', url: 'https://www.trulia.com/p/az/gilbert/1181-w-redondo-dr-gilbert-az-85233--2113456191' },
  { label: 'Coldwell Banker (MLS 6448966)', url: 'https://www.coldwellbankerhomes.com/az/gilbert/1181-w-redondo-dr/pid_48686821/' },
  { label: 'Catalina Bay tract history', url: 'https://www.realestatechandler.com/blog/catalina-bay-at-the-islands-homes-for-sale-gilbert.html' },
]

/**
 * How each modeled element was derived. Surfaced in the UI so nothing in the
 * render is mistaken for measured truth.
 */
export const derivation = [
  {
    element: 'Two-story massing, 36 ft x 38 ft footprint',
    basis: 'Record: 2 stories, 2,719 sq ft. Split across two floors gives ~1,360 sq ft per level; 36 x 38 matches that on a 40 ft wide lot.',
    confidence: 'derived',
  },
  {
    element: 'Lot 40 ft x 81 ft',
    basis: 'Record lot area ~3,245 sq ft. Ratio chosen to match a typical Catalina Bay zero-lot-line lake lot.',
    confidence: 'derived',
  },
  {
    element: 'Hip roof, 4:12 concrete tile',
    basis: 'Record: concrete tile roof. Pitch and hip form are the Blandford standard for this tract.',
    confidence: 'assumed',
  },
  {
    element: 'Two-car door + tandem third bay',
    basis: 'Record: 3 garage spaces. A 36 ft facade cannot fit three doors side by side, so the third bay is modeled as tandem depth.',
    confidence: 'assumed',
  },
  {
    element: 'Rear master balcony over covered patio',
    basis: 'Listing: master has panoramic lake views and a "generous patio area"; backyard has a covered patio.',
    confidence: 'derived',
  },
  {
    element: 'Pool, grass, lake walkway in rear yard',
    basis: 'Listing: pool, covered patio, grass area, walkway to lake views.',
    confidence: 'listed',
  },
  {
    element: 'Chimney chase on the west elevation',
    basis: 'Listing mentions a fireplace. Placement is a guess.',
    confidence: 'assumed',
  },
  {
    element: 'Window and door placement, colors, landscaping',
    basis: 'Not in any record. Styled to the tract vernacular (1990s Santa Fe / Southwest stucco).',
    confidence: 'assumed',
  },
  {
    element: 'Compass orientation',
    basis: 'Not verified. The model places the street on one side and the lake opposite; it is not georeferenced.',
    confidence: 'assumed',
  },
]

/** All model dimensions in feet. Origin at lot center, +Y up, +Z toward the street. */
export const model = {
  lot: { width: 40, depth: 81 },

  // Footprint: X in [-18, 18], Z in [-15.5, 22.5]
  house: {
    halfWidth: 18,
    frontZ: 22.5,
    rearZ: -15.5,
    floor1Height: 10,
    floor2Height: 9,
    // Second floor is set back from both ends of the first floor, which
    // creates the front porch/garage roof and the rear balcony deck.
    floor2FrontZ: 16.5,
    floor2RearZ: -9.5,
    roofPitch: 4 / 12,
    roofOverhang: 2,
  },

  entry: { x0: 2, x1: 12, z0: 16.5, z1: 26.5, height: 19.5, pitch: 5 / 12 },
  garageDoor: { x0: -16.5, x1: -0.5, height: 7.5 },

  driveway: { centerX: -8.5, width: 19 },
  patio: { x0: -14, x1: 4, projection: 9, height: 9 },
  pool: { centerX: 0, centerZ: -30.5, width: 22, length: 12, depth: 4.5 },

  street: { curbZ: 45, farZ: 78 },
  lake: { nearZ: -44, farZ: -260 },
}
