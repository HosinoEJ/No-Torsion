import { httpServerHandler } from 'cloudflare:node'
import { readFileSync } from 'node:fs'
import app from './app/server.js'
import { rebuildResponseWithHeaders } from './app/services/workerResponse.mjs'

const REFERRER_POLICY = 'strict-origin-when-cross-origin'
const CHINA_GEOJSON_PATH = '/bundle/public/cn.json'
const textEncoder = new TextEncoder()
let chinaGeoJsonPayload = null
let chinaGeoJsonBytes = null

app.listen(3000)

const nodeHandler = httpServerHandler({ port: 3000 })

function getChinaGeoJsonPayload() {
  if (chinaGeoJsonPayload === null) {
    const source = readFileSync(CHINA_GEOJSON_PATH, 'utf8')
    chinaGeoJsonPayload = JSON.stringify(JSON.parse(source))
  }

  return chinaGeoJsonPayload
}

function getChinaGeoJsonBytes() {
  if (chinaGeoJsonBytes === null) {
    chinaGeoJsonBytes = textEncoder.encode(getChinaGeoJsonPayload())
  }

  return chinaGeoJsonBytes
}

export default {
  async fetch(request, env, ctx) {
    const requestUrl = new URL(request.url)

    if (requestUrl.pathname === '/cn.json') {
      const body = getChinaGeoJsonBytes()

      return new Response(body, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=0, no-transform',
          'Content-Length': String(body.byteLength),
          'Referrer-Policy': REFERRER_POLICY
        }
      })
    }

    const response = await nodeHandler.fetch(request, env, ctx)
    return rebuildResponseWithHeaders(response, {
      // Workers 侧再兜一层，避免部署环境把 Referrer-Policy 覆盖回 no-referrer。
      'Referrer-Policy': REFERRER_POLICY
    })
  }
}
