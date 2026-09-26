#!/usr/bin/env node
// Writes the Token list's arc frames: 30 per color scheme, 64 px, to
// src/assets/default.r/arc/<scheme>/<n>.png. Output is generated, gitignored
// and never committed (docs/adr/0005-progress-arc-as-prerendered-image-frames.md).

import { build } from "esbuild"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { encodePng, renderArc } from "./arcFrames.mjs"

const OUT = "src/assets/default.r/arc"
const SIZE = 64

/**
 * The color schemes and frame count, from the TypeScript sources the watch
 * uses, so the frames cannot drift from them. Bundled in memory because Node
 * cannot run the TypeScript enums in `ColorSchemes.ts` directly.
 */
async function loadWatchConstants() {
  const { outputFiles } = await build({
    stdin: {
      contents: `export { ColorSchemes } from "./src/shared/ColorSchemes"
export { ARC_FRAME_COUNT } from "./src/page/arc"`,
      resolveDir: ".",
      loader: "ts"
    },
    bundle: true,
    format: "esm",
    write: false
  })
  const source = outputFiles[0].text
  return import(`data:text/javascript,${encodeURIComponent(source)}`)
}

const { ColorSchemes, ARC_FRAME_COUNT } = await loadWatchConstants()

await rm(OUT, { recursive: true, force: true })
for (const [scheme, colors] of Object.entries(ColorSchemes)) {
  const directory = join(OUT, scheme)
  await mkdir(directory, { recursive: true })
  for (let index = 0; index < ARC_FRAME_COUNT; index++) {
    const rgba = renderArc(SIZE, 1 - index / ARC_FRAME_COUNT, {
      primary: colors.primaryColor,
      secondary: colors.secondaryColor,
      background: colors.backgroundColor
    })
    await writeFile(
      join(directory, `${index}.png`),
      encodePng(SIZE, SIZE, rgba)
    )
  }
}
