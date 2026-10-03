# AI Guruz — Free public deployment

Everything on one free server: the website, the 8 backend services, MongoDB and HTTPS. AI comes from Groq's
free API tier. Nothing here costs money, but two free accounts are needed (Oracle Cloud and Groq).

```
Internet ──443──> Caddy (HTTPS) ──/api/*──> gateway ──> 7 services ──> MongoDB
                        └───────/*───────> web                └──────> Groq API (free tier)
                 └──────────── one Oracle Cloud Always Free ARM VM ────────────┘
```

| File | Purpose |
|---|---|
| `docker-compose.yml` | The whole stack: includes `backend/docker-compose.yml`, adds the web app and Caddy |
| `Caddyfile` | HTTPS and routing: `/api/*` to the gateway, everything else to the web app |
| `.env.example` | Settings; copied to `.env` on the server |
| `setup-server.sh` | One-time server setup and first deployment |

## What is free, and its limits

| Piece | Free option | Limits to know |
|---|---|---|
| Server | Oracle Cloud Always Free: Ampere A1 (ARM), up to 4 cores and 24 GB RAM | Sign-up asks for a card to verify identity (not charged for Always Free). ARM capacity is sometimes "out of capacity" in a region: retry later or pick another availability domain. Oracle may reclaim Always Free VMs that stay idle. |
| Database | MongoDB in a container on the same server | Data lives on the server's disk; there is no automatic backup. |
| HTTPS | Let's Encrypt, through Caddy | Automatic. |
| Address before the domain | `<server-ip-with-dashes>.sslip.io` | A free DNS name that points at your IP; replaced by aiguruz.com later. |
| AI | Groq free tier, model `llama-3.3-70b-versatile` | Per-minute and per-day request limits (see the Limits page in your Groq account). When the limit is hit, the platform falls back to its built-in extractive results and marks them as such. Document text is sent to Groq for processing. |

## Steps

### 1. Create the two accounts (you)

1. **Groq**: sign up at https://console.groq.com and create an API key (Keys → Create API key). Keep it for step 4.
2. **Oracle Cloud**: sign up at https://www.oracle.com/cloud/free/. Choose a home region close to your users
   (for India: Mumbai or Hyderabad). The home region cannot be changed later.

### 2. Create the server (Oracle console)

Compute → Instances → Create instance:

- **Image**: Ubuntu 24.04
- **Shape**: Ampere → `VM.Standard.A1.Flex`, 4 OCPU, 24 GB memory (the "Always Free eligible" one).
  Do not pick the AMD micro shape: with 1 GB of memory it cannot run this stack.
- **Networking**: keep the defaults and make sure "Assign a public IPv4 address" is on.
- **SSH keys**: let Oracle generate a key pair and download the private key.
- **Boot volume**: 100 GB (Always Free allows up to 200 GB in total).

Note the instance's **public IP address**.

### 3. Open the web ports (Oracle console)

Networking → Virtual cloud networks → your VCN → the public subnet → its Security List → Add Ingress Rules:

| Source CIDR | Protocol | Destination port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

### 4. Deploy (on the server)

Connect from your computer (PowerShell), using the key from step 2:

```powershell
ssh -i C:\path\to\ssh-key.key ubuntu@<public-ip>
```

Then on the server:

```bash
curl -fsSL https://raw.githubusercontent.com/DnyaneshSD1/ai-guruz/main/deploy/setup-server.sh -o setup-server.sh
bash setup-server.sh
```

The script asks for the site address (press Enter to accept the suggested `…sslip.io` name) and the Groq key.
It installs Docker, opens ports 80/443 on the server's own firewall, writes `deploy/.env` with a random
internal key, then builds and starts everything. The first build takes 15–30 minutes.

When it finishes, open `https://<public-ip-with-dashes>.sslip.io`, choose **Get started**, and register with
"New institution": that first account is the administrator.

### 5. Connect aiguruz.com (later)

1. At your domain registrar, add DNS records: `A` record for `@` and for `www`, both pointing to the server's public IP.
2. On the server, edit `~/ai-guruz/deploy/.env`:
   ```
   SITE_ADDRESS=aiguruz.com, www.aiguruz.com
   CORS_ALLOWED_ORIGINS=https://aiguruz.com
   ```
3. Apply it: `cd ~/ai-guruz/deploy && sudo docker compose up -d`

Caddy fetches the certificate for the new name on the next request. No rebuild is needed.

## Day to day

```bash
cd ~/ai-guruz/deploy
sudo docker compose ps                         # what is running
sudo docker compose logs -f --tail=100 gateway # logs of one service
git -C ~/ai-guruz pull && sudo docker compose up -d --build   # deploy the latest code from GitHub
sudo docker compose down                       # stop (data is kept in Docker volumes)
```

Back up the database (do this regularly, and copy the file off the server):

```bash
sudo docker compose exec -T mongo mongodump --archive --gzip > backup-$(date +%F).gz
```

## Mobile app

Point the app at the same address when building: `EXPO_PUBLIC_API_URL=https://aiguruz.com` (or the sslip.io
name). Because that is HTTPS, installed Android and iOS builds can reach it.

## Troubleshooting

- **The browser cannot connect**: step 3 (Security List) is missing, or the build is still running (`docker compose ps`).
- **Certificate error on first visit**: wait a minute and reload; Caddy requests the certificate on first use.
  Check `sudo docker compose logs caddy`.
- **"Out of capacity" when creating the VM**: try another availability domain, or retry at a different time of day.
- **AI results say "no AI model"**: the Groq key is wrong or the free limit was reached. Check
  `sudo docker compose logs analysis-service | grep fallback`.

## Status

This setup has not been run end to end from the development machine (it has no Docker, and the Oracle and Groq
accounts are yours to create). The backend, the Groq-compatible provider and the web build are tested; the
Compose and Caddy files are untested until the first deployment, so expect to check the logs on that first run.
