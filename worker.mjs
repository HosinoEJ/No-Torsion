import { httpServerHandler } from 'cloudflare:node'
import { readFileSync } from 'node:fs'
import app from './app/server.js'
import { rebuildResponseWithHeaders } from './app/services/workerResponse.mjs'

const REFERRER_POLICY = 'strict-origin-when-cross-origin'
const CHINA_GEOJSON_PATH = '/bundle/public/cn.json'
const MAP_DATA_API_PATH = '/api/map-data'
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

function buildIntegrityCacheControlHeader(existingValue) {
  const normalizedValue = String(existingValue || '').trim()

  if (!normalizedValue) {
    return 'no-transform'
  }

  if (normalizedValue.toLowerCase().includes('no-transform')) {
    return normalizedValue
  }

  return `${normalizedValue}, no-transform`
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

    if (requestUrl.pathname === MAP_DATA_API_PATH) {
      const response = await nodeHandler.fetch(request, env, ctx)

      return rebuildResponseWithHeaders(response, {
        // 对大 JSON 接口显式禁用中间链路变形，避免 Workers 侧再次截断或改写 body。
        'Cache-Control': buildIntegrityCacheControlHeader(response.headers.get('Cache-Control')),
        'Referrer-Policy': REFERRER_POLICY
      })
    }

    return nodeHandler.fetch(request, env, ctx)
  }
}
