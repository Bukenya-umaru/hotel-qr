import https from 'node:https'
import http from 'node:http'

const HOP_HEADERS = [
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

// Single source of truth for the backend location: set BACKEND_URL in the
// Netlify site settings (Environment variables), never in the repo.
function backendOrigin() {
  const value = process.env.BACKEND_URL
  if (!value) {
    throw new Error('BACKEND_URL environment variable is not set in Netlify.')
  }
  const backend = new URL(value)
  const localHttp = backend.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(backend.hostname)
  if (backend.protocol !== 'https:' && !localHttp) {
    throw new Error('BACKEND_URL must be an HTTPS origin.')
  }
  if (backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash) {
    throw new Error('BACKEND_URL must be a bare origin (no path, query, or credentials).')
  }
  return backend.origin
}

function buildTarget(event) {
  const origin = backendOrigin()
  // Netlify rewrites keep the original path in event.path and it is already
  // the backend-side path (/api/... or /uploads/...), so forward as-is.
  const path = event.path || '/'
  const rawQuery = event.rawQuery || ''
  return new URL(`${path}${rawQuery ? `?${rawQuery}` : ''}`, origin)
}

export const handler = async (event) => {
  let target
  try {
    target = buildTarget(event)
  } catch (error) {
    console.error(`API proxy configuration error: ${error.message}`)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'The API proxy is not configured correctly. Set BACKEND_URL in Netlify environment variables.' }),
    }
  }

  const headers = { ...event.headers }
  for (const name of HOP_HEADERS) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === name) delete headers[key]
    }
  }

  return new Promise((resolve) => {
    const transport = target.protocol === 'https:' ? https : http
    const proxyRequest = transport.request(target, {
      method: event.httpMethod,
      headers,
    }, proxyResponse => {
      const responseHeaders = { ...proxyResponse.headers }
      for (const name of HOP_HEADERS) {
        for (const key of Object.keys(responseHeaders)) {
          if (key.toLowerCase() === name) delete responseHeaders[name]
        }
      }
      const chunks = []
      proxyResponse.on('data', chunk => chunks.push(chunk))
      proxyResponse.on('end', () => {
        resolve({
          statusCode: proxyResponse.statusCode || 502,
          headers: responseHeaders,
          // The body is converted from base64 back to bytes by Netlify before
          // it reaches the browser, so marking it base64 unconditionally is
          // valid for JSON and binary responses alike.
          isBase64Encoded: true,
          body: Buffer.concat(chunks).toString('base64'),
        })
      })
    })

    proxyRequest.on('error', error => {
      console.error(`API proxy request failed: ${error.message}`)
      resolve({
        statusCode: 502,
        body: JSON.stringify({ message: 'Unable to reach the backend.' }),
      })
    })

    if (event.body) {
      proxyRequest.write(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
    }
    proxyRequest.end()
  })
}
