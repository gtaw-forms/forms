# Deploying the PHMC Discord Bot to Google Cloud

> **Current status:** Bot is running locally / on-prem. This guide covers migrating it to Google Cloud Platform (GCP).
> **Recommended service:** Compute Engine (a VM) — see *Why not Cloud Run?* below.

---

## Which GCP Service Should I Use?

| Service | CLI/Shell Access? | Persistent Disk? | Best For |
|---|---|---|---|
| **Compute Engine (VM)** | ✅ Full SSH | ✅ Persistent SSD | **This bot** — long-running process, file I/O, needs Chromium |
| Cloud Run | ❌ No SSH | ❌ Ephemeral | HTTP request-response services |
| Cloud Functions | ❌ No SSH | ❌ /tmp only | Event-driven one-shot functions |
| GKE (Kubernetes) | ✅ kubectl exec | ✅ Volumes | Overkill for one bot |

### Why Compute Engine?

Your bot has three traits that make serverless (Cloud Run / Cloud Functions) awkward:

1. **Long-running process** — Discord bots listen for events 24/7. Cloud Run idles containers after ~30 min of no HTTP traffic (and your bot doesn't serve HTTP). You'd need a keepalive hack.
2. **Browser automation** — Playwright + Chromium is ~300 MB of dependencies. It works in a container, but adds build complexity.
3. **Persistent files** — `forum-session.json` (forum cookies), `log.txt` (with rotation). On Cloud Run, local disk is ephemeral — you lose the session on every cold start and must re-login to the forum.

A small VM is simpler, cheaper, and gives you full control.

---

## Step 1: Create a Compute Engine VM

### Via Console (gcloud CLI)

```bash
# Install gcloud first if you haven't: https://cloud.google.com/sdk/docs/install

# Create a VM (e2-micro = free tier eligible)
gcloud compute instances create phmc-bot \
    --zone=us-central1-a \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --tags=discord-bot

# e2-micro has 2 vCPUs (burstable) and 1 GB RAM — plenty for this bot
# Choose a zone closest to your forum's server for lowest latency
```

### Via GCP Web Console

1. Go to **Compute Engine** > **VM Instances** > **Create Instance**
2. Name: `phmc-bot`
3. Region: `us-central1` (or whatever is closest)
4. Machine type: `e2-micro` (or `e2-small` if you want more headroom)
5. Boot disk: Ubuntu 22.04 LTS, 20 GB
6. Allow HTTP/HTTPS traffic (optional — the bot doesn't serve a web page)
7. Click **Create**

---

## Step 2: SSH Into the VM and Install Dependencies

```bash
# SSH in
gcloud compute ssh phmc-bot --zone=us-central1-a

# Once connected to the VM:
```

### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
node --version   # should be v20.x
npm --version    # should be 10.x
```

### Install Chromium & Playwright System Dependencies

```bash
# System libraries that Chromium needs
sudo apt install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libxdamage1 libxfixes3 libxcomposite1 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libatspi2.0-0 libwayland-client0

# Verify Chromium binary is available (Playwright on Linux uses its own bundled version,
# but the system libs above are required regardless)
```

---

## Step 3: Deploy the Bot

### Clone the Repository

```bash
cd /opt
sudo mkdir -p phmc-bot
sudo chown $USER: phmc-bot
git clone https://github.com/gtaw-forms/forms phmc-bot
cd phmc-bot/discord-bot
```

### Install Bot Dependencies

```bash
npm install
```

### Install Playwright Chromium

Playwright needs its own Chromium binary — this step downloads it:

```bash
npx playwright install chromium
```

> **Disk space note:** This adds ~300-400 MB. Your 20 GB disk is fine, just be aware.

### Set Up Environment Variables

```bash
cp .env.example .env
nano .env
```

Fill in your values:

```env
DISCORD_BOT_TOKEN=your_real_token_here
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_ADMIN_KEY_PATH=../firebase-admin-key.json
GUILD_ID=        (leave blank for global commands)
BOT_OWNER_ID=your_discord_user_id
FORUM_BASE_URL=http://lspd.gta.world
FORUM_USERNAME=your_forum_username
FORUM_PASSWORD=your_forum_password
HEADLESS=true
DEBUG=false
```

### Upload Firebase Admin Key

```bash
# From your local machine, scp the key file up:
gcloud compute scp /path/to/firebase-admin-key.json phmc-bot:/opt/phmc-bot/firebase-admin-key.json --zone=us-central1-a
```

Or if you already have the key contents, use `nano` on the VM to create the file directly.

### Test the Bot

```bash
# Run it in the foreground to test
node index.js
```

If it connects to Discord and slash commands register, you're good. Hit `Ctrl+C` to stop.

---

## Step 4: Run the Bot as a Service (Auto-Restart on Crash)

Create a systemd service so the bot starts on VM boot and auto-restarts if it crashes:

```bash
sudo nano /etc/systemd/system/phmc-bot.service
```

Paste this:

```ini
[Unit]
Description=PHMC Discord Bot
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/phmc-bot/discord-bot
ExecStart=/usr/bin/node /opt/phmc-bot/discord-bot/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

Replace `YOUR_USERNAME` with the actual VM username (run `whoami` to check).

```bash
# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable phmc-bot
sudo systemctl start phmc-bot

# Check status
sudo systemctl status phmc-bot

# View logs
sudo journalctl -u phmc-bot -f
```

### Useful systemd Commands

```bash
sudo systemctl status phmc-bot   # Check if running
sudo journalctl -u phmc-bot -f   # Live tail logs
sudo systemctl restart phmc-bot  # Restart
sudo systemctl stop phmc-bot     # Stop
```

---

## Step 5: Firewall & Security

### Discord Bot Doesn't Need Inbound Ports

The bot connects *outbound* to Discord, Firebase, and the forum. It doesn't listen for incoming connections.

- No need to open ports in GCP firewall
- No need for a static IP (but a static IP won't hurt if you want one)

### Firewall Rule (Optional — Only If Outbound Is Restricted)

If needed, the bot talks to these destinations:

| Destination | Port | Reason |
|---|---|---|
| `discord.com` | 443 (HTTPS) | Discord Gateway & API |
| `your-project-default-rtdb.firebaseio.com` | 443 | Firebase Realtime Database |
| `lspd.gta.world` (or whatever forum URL) | 80/443 | Forum posting via Playwright |

Default VPC allows all outbound traffic, so this should just work.

### IAM Service Account (Optional but Recommended)

Instead of storing `firebase-admin-key.json` on the VM, you can grant the Compute Engine default service account direct access to Firebase:

1. In GCP IAM, find the Compute Engine default service account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`)
2. Grant it **Firebase Admin** or **Firebase Realtime Database Admin** role
3. Then you can use `application-default` credentials instead of a JSON key

This is more secure but optional — the JSON key works fine for now.

---

## Step 6: Maintenance & Updates

### Updating the Bot

```bash
gcloud compute ssh phmc-bot --zone=us-central1-a

cd /opt/phmc-bot
git pull origin source
cd discord-bot
npm install
sudo systemctl restart phmc-bot
```

### Forum Session Persistence

`forum-session.json` lives on the VM's disk. It'll persist across bot restarts. If you ever replace the VM, copy this file over so users don't have to re-login.

### Log Rotation

The bot's `logger.js` already auto-rotates at 1 MB. Logs are at `/opt/phmc-bot/discord-bot/log.txt`. systemd also captures logs via `journalctl`.

---

## Cost Estimate

| Component | e2-micro (us-central1) | e2-small |
|---|---|---|
| **Monthly** | ~$7.50 (or **free** if within free tier) | ~$15 |
| **Free tier covers** | 1 e2-micro VM per month in us-central1/west1/east1 | ❌ |
| **Boot disk (20 GB)** | ~$0.40/mo (within free tier allowance of 30 GB) | ~$0.40 |

If you're within free tier: **$0/mo.** After free tier: **~$8/mo.**

Billing: https://cloud.google.com/compute/all-pricing

---

## Why Not Cloud Run? (Details)

Cloud Run *can* work, but you'd need these workarounds:

| Issue | Workaround Required |
|---|---|
| **Ephemeral disk** | Store `forum-session.json` in Firestore or GCS — load it on startup, write it back after login |
| **No persistent process** | The bot doesn't serve HTTP, so Cloud Run has no reason to keep it alive. You'd need a wrapper that polls Discord's Gateway or an external cron to ping it every 5 min |
| **Chromium size** | Must be in your Docker image (~300 MB added to image size) |
| **Cold starts** | Each cold start means re-logging into the forum (even with session in Firestore, you may need to re-authenticate) |
| **/restart command** | The restart command spawns a child process — this breaks in the container model |

If you ever want to explore Cloud Run anyway, the Discord.js docs have a guide: https://discordjs.guide/improving-dev-environment/cloud-hosting.html#google-cloud-run

---

## Quick-Start Checklist

- [ ] Create GCP project & enable Compute Engine API
- [ ] Create VM (`e2-micro`, Ubuntu 22.04)
- [ ] SSH in, install Node.js 20 + git
- [ ] Install Chromium system deps
- [ ] Clone repo, `npm install`
- [ ] `npx playwright install chromium`
- [ ] Set up `.env` with tokens
- [ ] Upload `firebase-admin-key.json`
- [ ] Test with `node index.js`
- [ ] Install systemd service for auto-restart
- [ ] Open Discord and try `/report status`, `/report form type:autopsy`
- [ ] Add more form types locally, then `git pull && sudo systemctl restart phmc-bot`

---

## Troubleshooting

### "Failed to launch browser" / Chromium errors

```bash
# Missing system libraries — re-run:
sudo apt install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libxdamage1 libxfixes3 libxcomposite1 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 libwayland-client0

# Or let Playwright install all deps:
npx playwright install-deps chromium
```

### Bot connects but slash commands don't appear

- Ensure `DISCORD_BOT_TOKEN` is correct
- Check the bot has the `applications.commands` scope in Discord Developer Portal
- Guild commands appear instantly; global commands take up to 1 hour

### Forum login fails from VM

- The VM's IP might differ from what the forum expects — check if the forum has IP-based restrictions
- Try `HEADLESS=false` temporarily to debug (but you can't see the GUI on a headless VM — you'd need X11 forwarding: `gcloud compute ssh -- -X`)
- The stealth plugin handles most Cloudflare challenges, but some advanced ones may fail

### "Can't reach Discord Gateway"

- Default VPC firewall allows all outbound — should work. If you've added restrictive firewall rules, allow TCP 443 outbound
- Corporate/proxy environments: the VM is on GCP's network, so there's no corporate proxy
