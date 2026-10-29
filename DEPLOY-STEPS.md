# Deploying Adatya to AWS EC2

Copy-paste steps for a single EC2 host running the whole stack over HTTPS,
with a free DuckDNS hostname.

Roughly 30 minutes, most of it waiting for AWS. Expect **$8–15/month** for a
`t4g.small` with 30 GB of storage, inside the free tier for the first year on
a `t4g.micro` if you prefer.

Everything below runs in a browser and an SSH session. Nothing needs the AWS
CLI on your laptop.

**One assumption you did not confirm:** PostgreSQL runs in a container on the
same instance, not on RDS. That is the cheap option and it is what these steps
set up. RDS would add roughly $15/month and give you managed backups and
point-in-time recovery; switching later is a one-line `DB_URL` change in
`.env`, so this is not a decision you are locked into. Say the word if you
would rather start on RDS.

---

## Before you start

You need:

- an AWS account with a payment method
- about 15 minutes of attention during certificate issuance

The app refuses to start without `JWT_SECRET`, so a half-configured box fails
loudly rather than running insecurely.

---

## 1. Get a free hostname

HTTPS needs a hostname; Let's Encrypt will not issue a certificate for a bare
IP address. DuckDNS gives you one free, and unlike `nip.io` it has its own
rate-limit budget with Let's Encrypt rather than a shared one that is
routinely exhausted.

1. Open <https://www.duckdns.org> and sign in with Google or GitHub.
2. Type a subdomain, for example `adatya-yourname`, and press **add domain**.
3. Leave the tab open. You will paste your EC2 address into it at step 4.

Your hostname is `adatya-yourname.duckdns.org`.

---

## 2. Launch the EC2 instance

In the AWS console, **EC2 → Instances → Launch instances**:

| Setting | Value |
|---|---|
| Name | `adatya-prod` |
| AMI | **Ubuntu Server 24.04 LTS** |
| Architecture | **64-bit (Arm)** |
| Instance type | `t4g.small` (or `t4g.micro` for free tier) |
| Key pair | Create one, download the `.pem`, keep it safe |
| Storage | 30 GB gp3 |

Under **Network settings → Edit**, add these inbound rules and no others:

| Type | Port | Source | Why |
|---|---|---|---|
| SSH | 22 | **My IP** | your admin access only |
| HTTP | 80 | Anywhere `0.0.0.0/0` | redirects to HTTPS, and Let's Encrypt validation |
| HTTPS | 443 | Anywhere `0.0.0.0/0` | the application |

**Do not open 5432.** PostgreSQL stays on the internal Docker network and is
never published to the host, so there is nothing to reach on that port.

Launch it. Then **Elastic IPs → Allocate**, and associate the new address with
the instance, so the address survives a reboot. Note it down.

---

## 3. Point the hostname at the instance

Back in the DuckDNS tab, paste the **Elastic IP** into the `current ip` box and
press **update ip**.

Check it from your laptop:

```bash
nslookup adatya-yourname.duckdns.org
```

It must return your Elastic IP before you continue. Certificate issuance fails
otherwise, and five failures in an hour will lock you out of retrying for a
while.

---

## 4. Connect and install Docker

```bash
chmod 400 adatya-prod.pem
ssh -i adatya-prod.pem ubuntu@YOUR_ELASTIC_IP
```

Then on the server:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu && newgrp docker
docker --version
```

---

## 5. Get the code and generate secrets

```bash
git clone -b master https://github.com/mohitrajurkar/Adatya-Your-Entire-Mandi-Business-in-One-Place..git adatya
cd adatya
chmod +x scripts/*.sh

./scripts/generate-prod-env.sh adatya-yourname.duckdns.org 9876543210
```

Use **your own** 10-digit mobile as the second argument; that becomes the owner
login.

`-b master` is not optional. The repository's default branch is still `main`,
which holds a snapshot from before the security and deployment work, with
none of these files in it. Cloning without it gets you the wrong code.

This writes `.env` with a freshly generated `JWT_SECRET`, database password and
one-time admin password, readable only by you. It deliberately does not reuse
your development secrets — those exist on a laptop, in shell history and in
backups, so they are not production credentials. It also refuses to overwrite
an existing `.env`, because rotating secrets under a running deployment locks
every signed-in trader out.

The secrets are not printed. Read the admin password when you need it:

```bash
grep DEFAULT_ADMIN_PASSWORD .env
```

---

## 6. Get the certificate and start everything

```bash
./scripts/init-letsencrypt.sh you@example.com
```

The email is only used by Let's Encrypt to warn you if renewal ever breaks.

The script writes a throwaway self-signed certificate so nginx can bind 443,
starts the stack, asks Let's Encrypt for the real one, and reloads. It checks
DNS first and warns before spending a rate-limited attempt.

**Rehearse first if you like**, which avoids the rate limit entirely:

```bash
STAGING=1 ./scripts/init-letsencrypt.sh you@example.com   # untrusted cert
./scripts/init-letsencrypt.sh you@example.com             # the real one
```

---

## 7. Check it

```bash
curl -sI https://adatya-yourname.duckdns.org | head -1
curl -sI https://adatya-yourname.duckdns.org | grep -i strict-transport
curl -sI http://adatya-yourname.duckdns.org | head -1     # expect 301
curl -s  https://adatya-yourname.duckdns.org/actuator/health
curl -s -o /dev/null -w '%{http_code}\n' https://adatya-yourname.duckdns.org/api/farmers   # expect 401
```

You want `200`, an HSTS header, a `301` on plain HTTP, `{"status":"UP"}`, and
`401` from the API without a token. That last one is the security lockdown
working, not a fault.

Open `https://adatya-yourname.duckdns.org` and sign in with the mobile number
and the password from step 5.

---

## 8. Close the one-time admin account

Sign in, open **Profile**, and change the password. Then on the server:

```bash
sed -i 's/^DEFAULT_ADMIN_MOBILE=.*/DEFAULT_ADMIN_MOBILE=/' .env
sed -i 's/^DEFAULT_ADMIN_PASSWORD=.*/DEFAULT_ADMIN_PASSWORD=/' .env
docker compose -f docker-compose.prod.yml up -d backend
```

The seeded account only ever gets created when it does not exist, and startup
never rewrites an existing password, so clearing these changes nothing about
your account. It just removes a live credential from a file on disk.

---

## 9. Nightly backups

```bash
mkdir -p ~/adatya/backups
crontab -e
```

Add:

```cron
0 2 * * * /home/ubuntu/adatya/scripts/backup-db.sh >> /home/ubuntu/adatya/backups/backup.log 2>&1
```

A dump every night at 02:00, keeping 14 days. The script reads the database
credentials from `.env` itself, because cron starts with almost no
environment, and it dumps through the database container, since port 5432 is
not published. It writes to a `.partial` file and only renames it once the
dump has finished and is a plausible size, so an interrupted backup is never
left behind looking usable.

Check it worked the next morning:

```bash
tail -5 ~/adatya/backups/backup.log && ls -lh ~/adatya/backups/
```

**Test the restore before you rely on it.** An untested backup is a guess:

```bash
./scripts/restore-db.sh ./backups/adatya_db_backup_YYYYMMDD_HHMMSS.sql.gz
```

It never drops anything: it stages the restore in a separate database, shows
live-versus-restored row counts, asks you to type the database name, then
switches by renaming and keeps the previous database under a dated name.

---

## Day-to-day

```bash
# deploy a new version
cd ~/adatya && git pull && docker compose -f docker-compose.prod.yml up -d --build

# logs
docker compose -f docker-compose.prod.yml logs -f backend

# status
docker compose -f docker-compose.prod.yml ps

# stop (leaves the data volume alone)
docker compose -f docker-compose.prod.yml down
```

Never use `down -v`; that deletes the database volume.

---

## If something is wrong

**Certificate issuance failed.** Almost always DNS. Confirm
`nslookup your-domain` returns the Elastic IP, and that port 80 is open to
`0.0.0.0/0` — Let's Encrypt validates over plain HTTP. Rehearse with
`STAGING=1` to avoid burning attempts.

**The site loads but every API call fails.** `CORS_ALLOWED_ORIGINS` in `.env`
must be exactly `https://your-domain`, with no trailing slash and not `http://`.

**The backend will not start.** `docker compose -f docker-compose.prod.yml logs backend`.
A missing `JWT_SECRET` is refused deliberately. A Flyway message means the
schema is mid-migration; it runs V1 to V3 automatically on a new database.

**Locked out after failed sign-ins.** Five failures locks that mobile number
for 15 minutes. Wait it out.

---

## What this does not cover

Worth knowing before real traders depend on it:

- **One instance, no redundancy.** If it fails, the app is down until you
  rebuild. Restoring from a nightly dump loses up to a day of entries.
- **The database shares the box.** Moving to RDS gives you managed backups and
  point-in-time recovery; it is a one-line `DB_URL` change in `.env`.
- **No monitoring or alerting.** Nothing tells you the box is down except a
  trader ringing you. A CloudWatch alarm on the instance is the cheap start.
- **DuckDNS is a free service** with no availability guarantee. Fine for a
  pilot; buy a domain before this becomes a business dependency.
