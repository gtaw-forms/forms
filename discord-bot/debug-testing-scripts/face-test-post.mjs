const API_KEY = 'fb_GBESkRqXc8NyNpLKN6liRcJJrcilwMsYss8n5cvKCCUWOW9Q'
const BASE = 'https://face.gta.world/api/v1/page-api'
const PAGE_ID = 1241

async function call(path, opts = {}) {
  const res = await fetch(BASE + path, {
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
  console.log(JSON.stringify(body, null, 2))
}

const created = await call('/posts', {
  method: 'POST',
  body: JSON.stringify({ page_id: PAGE_ID, content: 'test' }),
})
dump('POST /posts (content: "test")', created)

if (created.ok) {
  let postId = null
  if (created.body && created.body.post) postId = created.body.post.id
  else if (created.body && created.body.data) postId = created.body.data.id
  else if (created.body && created.body.id) postId = created.body.id
  else if (Array.isArray(created.body)) postId = created.body[0]?.id ?? null

  console.log(`\nextracted postId: ${postId ?? 'NOT FOUND'}`)

  if (postId) {
    const fetched = await call(`/posts/${postId}?page_id=${PAGE_ID}`)
    dump('GET /posts/{postId} (confirm shape)', fetched)

    const deleted = await call(`/posts/${postId}?page_id=${PAGE_ID}`, { method: 'DELETE' })
    dump('DELETE /posts/{postId}', deleted)

    const after = await call(`/posts?page_id=${PAGE_ID}`)
    dump('GET /posts (verify gone)', after)
  } else {
    console.log('[WARN] post created but no id extractable — manual cleanup needed')
  }
} else {
  console.log('[ABORT] POST failed — no post was created, nothing to delete')
}
