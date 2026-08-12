# Face (GTA World) Page API — Developer Reference

> Live-verified against the real API on 2026-08-04 via `discord-bot/debug-testing-scripts/face-probe.mjs` (read-only) and `face-test-post.mjs` (post + delete round-trip). Where documentation and reality disagreed, **reality wins** — discrepancies are marked **[VERIFIED]**.

## Security

- The two keys below are **live credentials**. Keep them in `discord-bot/.env` (`FACE_API_KEY`) for real scripts; the probe scripts hardcode them only as throwaway tooling.
- Keys are tied to a **user account**, not to pages. A key only sees pages that account owns/admins.

## API Keys

- Generate API keys in the Face dashboard. **Maximum 2 keys per user.**
- Auth via `Authorization: Bearer <KEY>` **or** `X-API-Key: <KEY>` header.
- Empty `/pages/mine` result = the key's account owns no pages yet. Create/assign the page under that same account.

| Key name | Key | Notes |
|---|---|---|
| `phmc-tools-bot-poster` | `fb_GBESkRqXc8NyNpLKN6liRcJJrcilwMsYss8n5cvKCCUWOW9Q` | Primary. Verified working. Account profile id 323 ("Alyson Frost"). |
| `testing` | `fb_G5MQ3XdqRoeGCVeTvKhWeIGltEgPNYqPlNx8x5MdKNErQlnU` | Secondary. Not yet probed. |

## Base URL

```
https://face.gta.world/api/v1/page-api
```

All endpoints except `GET /pages/mine` require `page_id` (query string or JSON body). `page_id` comes from `GET /pages/mine`.

## Getting Your Pages

```
GET /pages/mine
```

**Response (verified, 200):**
```json
{
  "pages": [
    {
      "id": 1241,
      "name": "123321",
      "username": "test1321",
      "category": "other"
    }
  ]
}
```

## Endpoints

| Method | Path | Auth | Status | Notes |
|---|---|---|---|---|
| `GET` | `/pages/mine` | Bearer/X-API-Key | 200 | List pages you manage. No `page_id` needed. |
| `POST` | `/posts` | + `page_id` (body) | **201** | Create post. Body: `{ page_id, content }` |
| `PUT` | `/posts/{postId}` | + `page_id` (query) | ? | Edit post. Body: `{ content }` |
| `DELETE` | `/posts/{postId}` | + `page_id` (query) | 200 | Returns `{"message":"Post deleted"}` |
| `GET` | `/posts/{postId}` | + `page_id` (query) | 200 | Single post, wrapped in `{"post": {...}}` |
| `GET` | `/posts` | + `page_id` (query) | 200 | **Cursor-paginated** list |
| `GET` | `/posts/{postId}/comments` | + `page_id` (query) | ? | List comments (unverified) |
| `POST` | `/posts/{postId}/comments` | + `page_id` (body) | ? | Add comment (unverified) |
| `POST` | `/messages/send` | + `page_id` (body) | ? | DM. Body: `{ page_id, profile_id, content }` |
| `GET` | `/dms` | + `page_id` (query) | 200 | **Page-paginated** conversations list |
| `GET` | `/dms/{conversationId}/messages` | + `page_id` (query) | ? | DM messages (unverified) |

`?` = not yet live-tested.

## Response Schemas (verified)

### Post object (`POST /posts`, `GET /posts/{postId}`)

Both endpoints wrap the post in `{"post": {...}}`. Key fields:

```jsonc
{
  "post": {
    "id": 361903,
    "profile_id": 323,          // author profile (the key's account)
    "target_profile_id": null,  // non-null = post on another profile's wall
    "group_id": null,
    "page_id": 1241,            // target page
    "type": "post",
    "content": "test",          // stored VERBATIM, plain text
    "visibility": "public",     // public | ? (undocumented options)
    "sharing_enabled": true,
    "can_share": true,
    "feeling": null,            // mood/feeling selector
    "activity": "added a post", // display string
    "location_tag": null,
    "background_color": null,   // colored post background
    "is_adult_content": null,
    "is_moderation_hidden": false,
    "moderation_hidden_at": null,
    "comments_disabled": false,
    "edited_at": null,
    "scheduled_at": null,       // ⚠️ scheduling support exposed but UNVERIFIED
    "is_scheduled": false,
    "is_published": true,
    "boosted_at": null,
    "boost_expires_at": null,
    "is_boosted": false,
    "pinned_at": null,
    "is_pinned": false,
    "created_at": "2026-08-04T16:31:26.000000Z",  // UTC ISO-8601
    "updated_at": "2026-08-04T16:31:26.000000Z",
    "profile": { /* full author profile */ },
    "page": { /* full page object */ },
    "media": [],                // media attachments
    "reactions_count": 0,
    "comments_count": 0,
    "shares_count": 0,
    "boost_views_count": null,
    "reaction_counts": [],
    "user_reaction": null,
    "is_saved": false,
    "is_hidden": false
  }
}
```

**Implication:** `visibility`, `scheduled_at`, `is_scheduled`, `is_published`, `media`, `background_color`, `feeling`, `location_tag`, `comments_disabled` are all post fields the docs never mention. POST may accept them as body params — **unverified, test before relying on them.**

### Post list (`GET /posts`) — CURSOR pagination

```json
{
  "data": [],                       // post objects (NOT wrapped in "post")
  "links": { "first": null, "last": null, "prev": null, "next": null },
  "meta": {
    "path": "http://face.gta.world/api/v1/page-api/posts",
    "per_page": 20,
    "next_cursor": null,            // pass as ?cursor= to page forward
    "prev_cursor": null
  }
}
```

- **Does NOT wrap posts** — they live directly in `data[]`, unlike single-post endpoints.
- Page forward with `GET /posts?page_id=X&cursor=<meta.next_cursor>`; `null` = no more pages.

### DMs (`GET /dms`) — PAGE pagination (different from posts!)

```json
{
  "conversations": [],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 20,
    "total": 0
  }
}
```

- **DMs use classic page-based pagination**, posts use cursors — do not share pagination code between them.
- Unclear page param name (`?page=` assumed, unverified).

### Error responses

Verified failure mode so far: non-2xx with a body. Exact error shape/status codes **unverified** (we only saw successes). Treat non-2xx as "read `body`, log it, do not assume schema".

## Content Format

- **Verified:** `content` is stored exactly as sent — `"test"` round-tripped verbatim (plain text, no wrapping).
- **Unverified:** whether BBCode in `content` renders in the feed, or is stripped/escaped. **Test with a BBCode string before building real templates.**

## DM Rules

- `POST /messages/send` only works if the target `profile_id` messaged the page **within the past 30 days**. Failure shape unverified.

## Known Gaps / Minefield

1. `PUT /posts` and comments endpoints — untested, response shapes unknown.
2. Scheduling / visibility / media params on POST — exposed in response fields but unverified as inputs.
3. Rate limits — none documented, none observed (our probe made ~10 requests in a minute without issue).
4. Error status codes and bodies — need to provoke a failure to document.
5. BBCode rendering.
6. DM conversation shape (`GET /dms/{conversationId}/messages`).

## Verified Workflow (post → confirm → delete)

```
POST /posts  { page_id: 1241, content: "test" }  -> 201 {"post":{"id":361903,...}}
GET  /posts/361903?page_id=1241                  -> 200 {"post":{...}}
DELETE /posts/361903?page_id=1241                -> 200 {"message":"Post deleted"}
```

## Probe Scripts

- `discord-bot/debug-testing-scripts/face-probe.mjs` — read-only: pages, post list, post detail, comments, DMs.
- `discord-bot/debug-testing-scripts/face-test-post.mjs` — one-shot: POST "test" → GET → DELETE → verify gone.
- `discord-bot/debug-testing-scripts/face-find-page.mjs` — find the PHMC Public Death Records page by name and write it to `.env` (`--set` → `FACE_PAGE_ID`).

## Production Integration

- `discord-bot/services/facePost.js` — API client (`postToFace`, `deleteFacePost`) + social post generator (`generateFacePostContent`). Reads `FACE_API_KEY` and `FACE_PAGE_ID` from `.env`.
- `discord-bot/services/deathRecordDraftFace.js` — Discord review/approve flow (`face_approve_*`, `face_edit_*`, `face_deny_*` buttons + edit modal). Drafts tracked at `facePostDrafts/<reportKey>` in Firebase.
- Trigger: `handleApprove` in `deathRecordDraftActions.js` auto-drafts the Face post after a Death Record is approved & posted to the forum. Gated by `FACE_DRY_RUN` (default `true`).
