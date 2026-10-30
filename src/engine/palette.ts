// Paleta, do której filtr pikselowy kwantyzuje obraz. Kolory scen dobieramy z tej samej listy.
export const PALETTE = [
  '#0f0f1b', '#1c1c2e', '#2b2d42', '#3d3f58', '#565a75', '#7a7f99', '#a4a9bd', '#cfd2dc', '#f4f1e6',
  '#4a4744', '#6b6560', '#8f877d', '#b3a99a', '#d6ccb8',
  '#5a2e22', '#8a3b2a', '#b5523a', '#d9734e', '#e8a074',
  '#c98f2c', '#f2d16b', '#ffe9a6',
  '#e8b4b8', '#b8d8c8', '#a8c6e0',
  '#1f3d2b', '#2e5e3a', '#4a8a45', '#7cb35a', '#b4d77a',
  '#1d3557', '#2c5d8a', '#4b8bbf', '#8fc1e3',
  '#5f9e8c', '#e05a47', '#3a2a40',
  // lawendowy spód chmur
  '#b9b4d6',
  // ciepłe półtony elewacji w cieniu
  '#9c7a5c', '#c2a67e', '#7d6450',
]

export const C: {
  [k: string]: string | string[] | Record<string, string[]> | Record<string, string>
  tree: string[]; treeAutumn: string[]; treeWinter: string[]
  walls: Record<string, string[]>; roofTile: string[]; roofFlat: string[]; roofChurch: string[]
  wallMaterial: Record<string, string>; roofMaterial: Record<string, string>
} = {
  ground: '#b3a99a',
  groundOut: '#ece6d6',
  asphalt: '#565a75',
  asphaltLight: '#6b6560',
  paving: '#d6ccb8',
  path: '#d6ccb8',
  plaza: '#e3d9c4',
  rail: '#5a4a44',
  tramTrack: '#3d3f58',
  grass: '#7cb35a',
  park: '#6aa64f',
  wood: '#2e5e3a',
  pitch: '#4a8a45',
  play: '#d9734e',
  farm: '#b4d77a',
  bare: '#c2a67e',
  water: '#2c5d8a',
  tree: ['#2e5e3a', '#4a8a45', '#3e7a3e', '#1f3d2b'],
  treeAutumn: ['#c98f2c', '#d9734e', '#b5523a', '#f2d16b'],
  treeWinter: ['#6b6560', '#5a4a44', '#8f877d'],
  walls: {
    // kamienice i stara zabudowa: pastele, ochry, czasem cegła
    res: ['#f4f1e6', '#e8dcc0', '#d6ccb8', '#f2d16b', '#e8b4b8', '#b8d8c8', '#e8a074', '#ffe9a6', '#c2a67e'],
    // bloki i nowsze budynki: biele, beże, szarości
    modern: ['#f4f1e6', '#e8dcc0', '#d6ccb8', '#cfd2dc', '#b3a99a', '#f4f1e6', '#d6ccb8', '#a4a9bd'],
    gen: ['#d6ccb8', '#cfd2dc', '#e8dcc0', '#b3a99a', '#f4f1e6'],
    com: ['#a4a9bd', '#cfd2dc', '#7a7f99', '#d6ccb8', '#4b8bbf'],
    pub: ['#e8dcc0', '#d6ccb8', '#cfd2dc', '#f4f1e6'],
    church: ['#8a3b2a', '#b5523a', '#8a3b2a'],
    ind: ['#8a3b2a', '#8f877d', '#a4a9bd'],
    low: ['#8f877d', '#b3a99a'],
    roof: ['#7a7f99'],
    ruin: ['#6b6560'],
    chimney: ['#cfd2dc'],
    tank: ['#cfd2dc', '#a4a9bd', '#b3a99a'],
  },
  // kolory materiałów z OSM (building:material / roof:material)
  wallMaterial: {
    brick: '#8a3b2a', concrete: '#cfd2dc', reinforced_concrete: '#cfd2dc', glass: '#4b8bbf', mirror: '#8fc1e3',
    wood: '#7d6450', stone: '#d6ccb8', sandstone: '#e8dcc0', marble: '#f4f1e6', metal: '#a4a9bd', steel: '#a4a9bd', copper: '#5f9e8c',
  } as Record<string, string>,
  roofMaterial: {
    roof_tiles: '#b5523a', tar_paper: '#565a75', metal: '#a4a9bd', copper: '#5f9e8c', glass: '#8fc1e3', concrete: '#a4a9bd',
    brick: '#8a3b2a', grass: '#4a8a45', roof_greening: '#4a8a45', plants: '#4a8a45', gravel: '#8f877d', slate: '#3d3f58',
  } as Record<string, string>,
  roofTile: ['#b5523a', '#d9734e', '#8a3b2a', '#b5523a'],
  // płaskie dachy: papa i żwir (ciepłe szarości, nie jasne, bo paleta zamienia je w błękit)
  roofFlat: ['#6b6560', '#8f877d', '#565a75', '#7d6450', '#8f877d'],
  roofChurch: ['#5f9e8c', '#3d3f58', '#8a3b2a'],
}
