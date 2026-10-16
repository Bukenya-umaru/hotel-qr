import https from 'node:https'
import http from 'node:http'

export const config = { api: { bodyParser: false } }

const REQUEST_HOP_HEADERS = [
  'connection',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]

function backendOrigin() {
  const value = process.env.BACKEND_URL
  if (!value) throw new Error('BACKEND_URL must be configured in the Vercel environment.')

  const backend = new URL(value)
  const localHttp = backend.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(backend.hostname)
  if (backend.protocol !== 'https:' && !localHttp) {
    throw new Error('BACKEND_URL must use HTTPS.')
  }
  if (backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash) {
    throw new Error('BACKEND_URL must be an origin without credentials, path, query, or fragment.')
  }
  return backend.origin
}

export default function handler(req, res) {
  let target
  try {
    const origin = backendOrigin()
    target = new URL(req.url, origin)
    if (target.origin !== origin || !target.pathname.startsWith('/api/') &&
      !target.pathname.startsWith('/api/proxy/uploads/')) {
      return res.status(400).json({ message: 'Invalid API path.' })
    }
    if (target.pathname.startsWith('/api/proxy/uploads/')) {
      target.pathname = target.pathname.replace('/api/proxy/uploads/', '/uploads/')
    }
  } catch (error) {
    console.error(`API proxy configuration error: ${error.message}`)
    return res.status(500).json({ message: 'The API proxy is not configured correctly.' })
  }

  const headers = Object.fromEntries(
    Object.entries(req.headers).filter(([, value]) => value !== undefined),
  )
  for (const name of REQUEST_HOP_HEADERS) delete headers[name]
  const proxyRequest = (target.protocol === 'https:' ? https : http).request(target, {
    method: req.method,
    headers,
  }, proxyResponse => {
    const responseHeaders = { ...proxyResponse.headers }
    for (const name of REQUEST_HOP_HEADERS) delete responseHeaders[name]
    res.writeHead(proxyResponse.statusCode || 502, responseHeaders)
    proxyResponse.pipe(res)
  })

  proxyRequest.on('error', error => {
    console.error(`API proxy request failed: ${error.message}`)
    if (res.headersSent) return res.destroy(error)
    res.status(502).json({ message: 'Unable to reach the backend.' })
  })
  req.pipe(proxyRequest)
}
