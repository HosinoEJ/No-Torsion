import { httpServerHandler } from 'cloudflare:node'
import app from './app/server.js'

const REFERRER_POLICY = 'strict-origin-when-cross-origin'

app.listen(3000)

const nodeHandler = httpServerHandler({ port: 3000 })

export default {
  async fetch(request, env, ctx) {
    const response = await nodeHandler.fetch(request, env, ctx)
    const headers = new Headers(response.headers)

    // Workers 侧再兜一层，避免部署环境把 Referrer-Policy 覆盖回 no-referrer。
    headers.set('Referrer-Policy', REFERRER_POLICY)

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }
}
