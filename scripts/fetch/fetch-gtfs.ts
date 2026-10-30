// Pobiera rozkład jazdy MPK Wrocław (GTFS) z mirrora MobilityData i rozpakowuje do data/gtfs.
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

const URL = 'https://storage.googleapis.com/storage/v1/b/mdb-latest/o/pl-dolnoslaskie-mpk-wroclaw-gtfs-980.zip?alt=media'
await mkdir('data/gtfs', { recursive: true })
const res = await fetch(URL)
if (!res.ok) throw new Error(`GTFS: HTTP ${res.status}`)
await writeFile('data/gtfs/gtfs.zip', Buffer.from(await res.arrayBuffer()))
execFileSync('unzip', ['-o', '-q', 'data/gtfs/gtfs.zip', '-d', 'data/gtfs'])
console.log('GTFS rozpakowany do data/gtfs')
