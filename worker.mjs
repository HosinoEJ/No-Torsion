import { httpServerHandler } from 'cloudflare:node'
import { readFileSync } from 'node:fs'
import app from './app/server.js'
import runtimeContext from './app/services/runtimeContext.js'
import { rebuildResponseWithHeaders } from './app/services/workerResponse.mjs'

// Workers 入口主要做两件额外工作：
// 1. 直接托管大体积 cn.json；
// 2. 重建 /api/map-data 响应，防止大 JSON 在中间链路被改写。
const REFERRER_POLICY = 'strict-origin-when-cross-origin'
const CHINA_GEOJSON_PATH = '/bundle/public/cn.json'
const MAP_DATA_API_PATH = '/api/map-data'
const textEncoder = new TextEncoder()
let chinaGeoJsonPayload = null
let chinaGeoJsonBytes = null

// Workers 里仍显式拉起 nodeHandler，对维护者来说要牢记：
// 绝大多数业务逻辑仍跑在 Express 层，Workers 这里只做入口级补丁。
app.listen(3000)

const nodeHandler = httpServerHandler({ port: 3000 })

function fetchWithRuntimeContext(request, env, ctx) {
  return runtimeContext.runWithRuntimeContext({ env, ctx }, () => nodeHandler.fetch(request, env, ctx))
}

function getChinaGeoJsonPayload() {
  if (chinaGeoJsonPayload === null) {
    // 读出后立刻 parse + stringify，可把 bundle 中格式差异统一成稳定 JSON 字符串。
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
      const response = await fetchWithRuntimeContext(request, env, ctx)

      return rebuildResponseWithHeaders(response, {
        // 对大 JSON 接口显式禁用中间链路变形，避免 Workers 侧再次截断或改写 body。
        // 如果未来又出现“地图数据偶发不完整”，这里和 workerResponse.mjs 是第一检查点。
        'Cache-Control': buildIntegrityCacheControlHeader(response.headers.get('Cache-Control')),
        'Referrer-Policy': REFERRER_POLICY
      })
    }

    return fetchWithRuntimeContext(request, env, ctx)
  }
}
