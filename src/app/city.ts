// Miasto w 3D: renderer, scena, kamera, materiały i wszystkie warstwy (bez ruchu ulicznego i scenek, które
// powstają dopiero po wczytaniu kafli, patrz src/app.ts).
import * as THREE from 'three'
import { loadJson } from '../engine/data.ts'
import { PixelPass } from '../engine/pixel.ts'
import { Sun } from '../engine/sun.ts'
import { Dwarfs } from '../layers/dwarfs.ts'
import { type Monument, Monuments } from '../layers/monuments.ts'
import { Neons } from '../layers/neons.ts'
import { tramGeometry } from '../life/life.ts'
import { Timetable } from '../life/timetable.ts'
import type { TramSchedule, WorldMeta } from '../types/world.ts'
import { byId } from '../ui/dom.ts'
import { C } from '../engine/palette.ts'
import { FOG_COLOR, buildCloudEdge } from '../world/edge.ts'
import { buildBase } from '../world/ground.ts'
import { HistoryLayer } from '../world/history.ts'
import { buildStands } from '../world/stadiums.ts'
import { Structures } from '../world/structures.ts'
import { Tiles } from '../world/tiles.ts'
import { waterShader } from '../world/water.ts'
import { windowShader } from '../world/windows.ts'
import { View } from './view.ts'

export type City = Awaited<ReturnType<typeof buildCity>>

const MEADOW = typeof C.grass === 'string' ? C.grass : '#7cb35a'

export async function buildCity(meta: WorldMeta) {
  const canvas = byId<HTMLCanvasElement>('map')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  // mapa cieni liczona tylko po zmianie widoku albo kilka razy na sekundę (auta i tramwaje), zamiast co klatkę
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.type = THREE.PCFShadowMap
  const pixel = new PixelPass(renderer)

  const scene = new THREE.Scene()
  // za brzegiem mapy: mgła i pas chmur zamiast szarego tła
  scene.background = new THREE.Color(FOG_COLOR)
  scene.add(buildCloudEdge(meta.bounds), outsidePlane(meta.bounds))
  const view = new View(canvas)

  // noc (okna), śnieg (dachy, ulice) i czas (fale na wodzie) wspólne dla materiałów
  const uniforms = { uNight: { value: 0 }, uSnow: { value: 0 } }
  const roadUniforms = { uNight: uniforms.uNight, uSnow: { value: 0 } }
  const uTime = { value: 0 }
  const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true })
  const groundMat = windowShader(lambert(), uniforms)
  const base = new THREE.Mesh(buildBase(meta.bounds), groundMat)
  base.receiveShadow = true
  scene.add(base)
  const tiles = new Tiles(meta, {
    ground: groundMat,
    roads: windowShader(lambert(), roadUniforms),
    water: waterShader(lambert(), uTime),
    buildings: windowShader(lambert(), uniforms),
  })

  // rozkład tramwajów (GTFS MPK) startuje od razu, bez czekania na kafle; brak pliku = tramwaje losowo po torach
  const trams = await loadJson<TramSchedule>('trams.json')
  const timetable = trams ? new Timetable(trams, tramGeometry()) : null
  // pomniki (scripts/bake/bake-monuments.ts); brak pliku = brak warstwy
  const monumentData = await loadJson<Monument[]>('monuments.json')
  const monuments = monumentData ? new Monuments(monumentData) : null

  const stands = buildStands(meta.stadiums)
  const structures = new Structures(meta.structures, meta.aerialways)
  const history = new HistoryLayer(meta, tiles.waterMaterial)
  const neons = new Neons()
  const dwarfs = new Dwarfs(meta.dwarfs)
  scene.add(tiles.group, stands, structures.group, history.group, neons.group, dwarfs.mesh)
  if (timetable) scene.add(timetable.mesh)
  if (monuments) scene.add(monuments.group)
  const sun = new Sun(scene)
  // łąka zamiast dzisiejszego terenu w dawnych epokach (src/app/apply.ts): nad podkładem, pod wodą (0.1 m)
  const meadow = meadowPlane(meta.bounds)
  scene.add(meadow)

  return {
    meta,
    canvas,
    renderer,
    pixel,
    scene,
    view,
    camera: view.camera,
    uniforms,
    roadUniforms,
    uTime,
    tiles,
    world: tiles.world,
    timetable,
    monuments,
    stands,
    structures,
    history,
    neons,
    dwarfs,
    sun,
    meadow,
    base,
  }
}

function meadowPlane([bx0, by0, bx1, by1]: WorldMeta['bounds']) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0, by1 - by0), new THREE.MeshLambertMaterial({ color: MEADOW }))
  m.rotation.x = -Math.PI / 2
  m.position.set((bx0 + bx1) / 2, 0.05, -(by0 + by1) / 2)
  m.receiveShadow = true
  m.visible = false
  return m
}

// Poza obszarem danych: płaska, nieoświetlona płaszczyzna w kolorze tła (pod wałem chmur).
function outsidePlane([bx0, by0, bx1, by1]: WorldMeta['bounds']) {
  const margin = 30000
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(bx1 - bx0 + margin, by1 - by0 + margin),
    new THREE.MeshBasicMaterial({ color: FOG_COLOR }),
  )
  plane.rotation.x = -Math.PI / 2
  plane.position.set((bx0 + bx1) / 2, -0.3, -(by0 + by1) / 2)
  return plane
}
