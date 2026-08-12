const API_KEY = 'fb_GBESkRqXc8NyNpLKN6liRcJJrcilwMsYss8n5cvKCCUWOW9Q'
const BASE = 'https://face.gta.world/api/v1/page-api'

async function call(path, opts = {}) {
  const url = path.startsWith('http') ? path : BASE + path
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  let body = null
  try { body = await res.json() } catch { body = await res.text() }
  return { status: res.status, ok: res.ok, body }
}

function dump(label, { status, ok, body }) {
  console.log(`\n=== ${label} ===`)
  console.log(`status: ${status} (${ok ? 'OK' : 'FAIL'})`)
  if (!ok) console.log('error body:', JSON.stringify(body, null, 2))
  else console.log(JSON.stringify(body, null, 2))
}

const pages = await call('/pages/mine')
dump('GET /pages/mine', pages)
if (!pages.ok || !Array.isArray(pages.body.pages) || pages.body.pages.length === 0) {
  console.log('\n[ABORT] no pages returned — key or permission problem')
  process.exit(1)
}

for (const page of pages.body.pages) {
  const pageId = page.id
  console.log(`\n\n########## PAGE ${pageId} (${page.name}) ##########`)

  const list = await call(`/posts?page_id=${pageId}`)
  dump('GET /posts (list)', list)

  let postId = null
  const items = list.body?.posts ?? list.body?.data ?? list.body
  if (Array.isArray(items) && items.length > 0) {
    postId = items[0].id ?? Object.values(items[0])[0]
    dump('first post object', { status: list.status, ok: list.ok, body: items[0] })

    const one = await call(`/posts/${postId}?page_id=${pageId}`)
    dump('GET /posts/{postId}', one)

    const comments = await call(`/posts/${postId}/comments?page_id=${pageId}`)
    dump('GET /posts/{postId}/comments', comments)
  } else {
    console.log('(no posts on this page)')
  }

  const dms = await call(`/dms?page_id=${pageId}`)
  dump('GET /dms', dms)
}

console.log('\n[DONE] read-only probe complete — no mutations performed')
