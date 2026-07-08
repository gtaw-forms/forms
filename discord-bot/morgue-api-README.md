# PHMC Morgue REST API

Base URL: `http://88.208.243.254`

All morgue endpoints require an API key. You should have received one from the PHMC team.

---

## Authentication

Provide your API key in one of two ways:

**Via header (preferred):**
```http
GET /api/morgue
x-api-key: pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c
```

**Via query parameter:**
```http
GET /api/morgue?key=pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c
```

---

## Endpoints

### Health Check (no key required)

```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "service": "phmc-morgue-api",
  "morgueDataVersion": "17",
  "timestamp": "2026-07-04T12:00:00.000Z"
}
```

### Version Check (no key required)

A lightweight endpoint that returns only the data version. Check this first — if the version matches what you already fetched, skip the full download.

```
GET /api/version
```

Response:
```json
{
  "morgueDataVersion": "17"
}
```

### List / Search Morgue Records

```
GET /api/morgue
```

**Query parameters:**

| Param   | Type   | Default | Description                                                  |
|---------|--------|---------|--------------------------------------------------------------|
| `q`     | string | (none)  | Search term — matches name, case ID, and location            |
| `limit` | number | 100     | Max records to return (max 500)                              |
| `source`| string | (none)  | Optional identifier for your app (appears in server logs)    |
| `key`   | string | (auth)  | API key (alternative to `x-api-key` header)                  |

**Examples:**

Get all records (most recent first):
```http
GET /api/morgue
x-api-key: pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c
```

Search by name or case:
```http
GET /api/morgue?q=John+Doe
x-api-key: pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c
```

Search with custom limit and source tracking:
```http
GET /api/morgue?q=2024&limit=5&source=MyBot
x-api-key: pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "total": 15,
  "query": "John Doe",
  "morgueDataVersion": "17",
  "records": [
    {
      "firebaseKey": "-OABCDE12345",
      "name": "John Doe",
      "caseId": "2024-001",
      "location": "Vespucci Beach",
      "lastUpdated": 1720000000000,
      "adminNote": null
    }
  ]
}
```

Record fields commonly available:
| Field        | Type   | Description                         |
|------------- |--------|-------------------------------------|
| `firebaseKey`| string | Unique Firebase key for the record  |
| `name`       | string | Decedent's name                     |
| `caseId`     | string | Case identifier                     |
| `location`   | string | Location of death/discovery         |
| `lastUpdated`| number | Unix timestamp (ms) of last update  |
| `adminNote`  | string | Internal admin notes (may be null)  |

### Get Single Record by Firebase Key

```
GET /api/morgue/:firebaseKey
```

**Example:**
```http
GET /api/morgue/-OABCDE12345
x-api-key: pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c
```

**Response:**
```json
{
  "success": true,
  "record": {
    "firebaseKey": "-OABCDE12345",
    "name": "John Doe",
    "caseId": "2024-001",
    "location": "Vespucci Beach",
    "lastUpdated": 1720000000000
  }
}
```

Returns `404` if the key doesn't match any record.

### View Recent Activity

```
GET /api/activity
```

Shows the last 200 API calls, useful to see who's using the API and how often. Requires API key auth.

**Query parameters:**

| Param   | Type   | Default | Description                    |
|---------|--------|---------|--------------------------------|
| `limit` | number | 50      | Recent entries to return (max 200) |

**Example:**
```http
GET /api/activity?limit=10
x-api-key: pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "total": 47,
  "activity": [
    {
      "time": "2026-07-04T22:40:00.000Z",
      "method": "GET",
      "path": "/api/morgue",
      "query": "Smith",
      "source": "MyDiscordBot",
      "key": "key_pmc_mor...",
      "status": 200,
      "ms": 234
    }
  ]
}
```

### Error Responses

**401 — Missing or invalid API key:**
```json
{
  "error": "Unauthorized",
  "message": "Missing API key. Provide it via x-api-key header or ?key= query parameter."
}
```

**429 — Rate limit exceeded (60 req/min per key):**
```json
{
  "error": "Too many requests",
  "message": "Rate limit of 60 requests per minute exceeded."
}
```

**500 — Server error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Failed to fetch morgue records."
}
```

---

## Integration Examples

### cURL
```bash
curl -H "x-api-key: pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c" \
  "http://88.208.243.254/api/morgue?q=Smith&source=MyApp"
```

### Python
```python
import requests

API_KEY = "pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c"
BASE_URL = "http://88.208.243.254"

resp = requests.get(
    f"{BASE_URL}/api/morgue",
    headers={"x-api-key": API_KEY},
    params={"q": "Jane Roe", "limit": 10, "source": "MyBot"}
)

if resp.status_code == 200:
    data = resp.json()
    for record in data["records"]:
        print(f"{record['caseId']} — {record['name']} ({record['location']})")
else:
    print(f"Error {resp.status_code}: {resp.json()['message']}")
```

### JavaScript / Node.js
```js
const API_KEY = "pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c";

async function searchMorgue(query) {
  const res = await fetch(`http://88.208.243.254/api/morgue?q=${encodeURIComponent(query)}&source=MyApp`, {
    headers: { "x-api-key": API_KEY }
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Usage
searchMorgue("Vespucci").then(data => {
  console.log(`Found ${data.count} records`);
});
```

### Discord Bot (discord.js)
```js
const API_KEY = "pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c";
const BASE_URL = "http://88.208.243.254";

async function fetchMorgueRecords(searchTerm) {
  const url = new URL(`${BASE_URL}/api/morgue`);
  if (searchTerm) url.searchParams.set("q", searchTerm);
  url.searchParams.set("source", "MyDiscordBot");
  url.searchParams.set("key", API_KEY);

  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}
```

---

## Smart Fetching (Cache-Busting)

Each response includes `morgueDataVersion`. Use it to avoid re-downloading when nothing changed:

**Python:**
```python
import requests, json, os

API_KEY = "pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c"
BASE_URL = "http://88.208.243.254"
CACHE_FILE = "morgue_cache.json"
VERSION_FILE = "morgue_version.txt"

# Step 1: Check version (lightweight, no auth needed)
ver = requests.get(f"{BASE_URL}/api/version").json()
cached_version = open(VERSION_FILE).read().strip() if os.path.exists(VERSION_FILE) else None

if ver["morgueDataVersion"] == cached_version:
    print("No changes — using cached data")
else:
    print("New version detected — downloading...")
    resp = requests.get(
        f"{BASE_URL}/api/morgue",
        headers={"x-api-key": API_KEY},
        params={"source": "MyApp"}
    )
    data = resp.json()
    # Cache it
    with open(CACHE_FILE, "w") as f:
        json.dump(data["records"], f)
    with open(VERSION_FILE, "w") as f:
        f.write(str(data["morgueDataVersion"]))
    print(f"Saved {len(data['records'])} records (v{data['morgueDataVersion']})")
```

**Node.js:**
```js
const API_KEY = "pmc_morgue_7f8a3b2c9d1e4f5a6b7c8d9e0f1a2b3c";
const BASE_URL = "http://88.208.243.254";

async function getMorgueRecords() {
  // Check version first (no auth, super fast)
  const ver = await fetch(`${BASE_URL}/api/version`).then(r => r.json());

  // Compare with cached version
  const local = localStorage.getItem('morgue_version');
  if (ver.morgueDataVersion === local) {
    return JSON.parse(localStorage.getItem('morgue_cache'));
  }

  // Download fresh data
  const res = await fetch(`${BASE_URL}/api/morgue?source=MyApp`, {
    headers: { "x-api-key": API_KEY }
  });
  const data = await res.json();

  localStorage.setItem('morgue_version', data.morgueDataVersion);
  localStorage.setItem('morgue_cache', JSON.stringify(data.records));
  return data.records;
}
```

- **60 requests per minute** per API key
- Applies independently to each key — different keys don't share the limit
- Exceeded limits return HTTP `429`

---

## Updating Your API Key

If your key needs to be rotated or revoked, contact the PHMC team. They will generate a new key and update the server — no code change needed on your end beyond updating the key string.

---

## Support

For issues or questions, contact the PHMC development team.
