# MMSR Publications V2 — Production Deployment & Operations Guide for GoDaddy VPS

**Platform:** Next.js 15 (Frontend) + Django 5.2 LTS REST Framework (Backend)  
**Database:** MySQL 8.0 (InnoDB)  
**Cache & Throttles:** Redis 7 (Localhost)  
**Process Managers:** Systemd (Gunicorn) + PM2 (Next.js)  
**Reverse Proxy & TLS:** Nginx + Let's Encrypt Certbot  
**Target Operating System:** Ubuntu 24.04 LTS (Noble Numbat) on GoDaddy VPS  
**Payment Gateway:** Razorpay (Test Mode initially, Live Mode on owner approval)

---

## Command Context Key
Every command in this guide is explicitly labeled with its execution location:
- `[LOCAL WINDOWS POWERSHELL]` — Run in PowerShell on your local Windows PC.
- `[GODADDY VPS SSH TERMINAL]` — Run inside the SSH shell connected to the GoDaddy VPS.

---

## Step 1: GoDaddy VPS Purchase Specifications & OS Selection

When ordering your GoDaddy Linux VPS from the GoDaddy dashboard:
1. **Operating System:** Select **Ubuntu 24.04 LTS** (64-bit).
2. **Server Tier / Plan:** Choose at least **Tier 2 or Tier 3** (Standard RAM):
   - **vCPU:** 4 vCPU (or minimum 2 vCPU)
   - **RAM:** 8 GB RAM (minimum 4 GB RAM)
   - **Storage:** 100 GB to 200 GB NVMe SSD
3. **Data Center Location:** Select the region closest to your primary audience (e.g., India / Singapore for Asia-Pacific visitors).
4. **IP Address:** Note your VPS **Public IPv4 Address** provided in the GoDaddy server dashboard (e.g. `198.51.100.25`).

---

## Step 2: Initial SSH Connection from Windows

Once GoDaddy sends your root credentials, connect from Windows:

```powershell
# [LOCAL WINDOWS POWERSHELL]
# Connect as root to your VPS IP address
ssh root@YOUR_GODADDY_VPS_IP
```
*What it does:* Establishes a secure encrypted terminal session to your remote Ubuntu server.  
*Safety:* Safe. Prompts to accept the server's fingerprint on first connection (type `yes`).

---

## Step 3: Create a Dedicated Deployer User & Harden SSH

Do not run web services directly as root. Create a dedicated administrative user:

```bash
# [GODADDY VPS SSH TERMINAL]
# 1. Create a new administrative user named 'mmsr_admin'
adduser mmsr_admin

# 2. Grant sudo privileges
usermod -aG sudo mmsr_admin

# 3. Copy root's authorized SSH keys to the new user (so you can log in directly)
mkdir -p /home/mmsr_admin/.ssh
cp /root/.ssh/authorized_keys /home/mmsr_admin/.ssh/ 2>/dev/null || true
chown -R mmsr_admin:mmsr_admin /home/mmsr_admin/.ssh
chmod 700 /home/mmsr_admin/.ssh
chmod 600 /home/mmsr_admin/.ssh/authorized_keys 2>/dev/null || true
```
*What it does:* Creates a standard Ubuntu user with `sudo` rights for managing the website safely.

---

## Step 4: Configure UFW Firewall

Lock down external network access so only web traffic and SSH can reach the server:

```bash
# [GODADDY VPS SSH TERMINAL]
# Default policy: block all unsolicited incoming traffic, allow outbound
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (Port 22) - NEVER skip this or you will be locked out
sudo ufw allow OpenSSH

# Allow HTTP (Port 80) and HTTPS (Port 443)
sudo ufw allow 'Nginx Full'

# Enable the firewall
sudo ufw --force enable

# Check status
sudo ufw status verbose
```
*What it does:* Protects MySQL (`3306`), Redis (`6379`), Next.js (`3000`), and Gunicorn (`8000`) from being reached from the public internet.

---

## Step 5: Install System Dependencies (Python 3.12, Nginx, Redis, MySQL)

Ubuntu 24.04 LTS includes Python 3.12, MySQL 8, and Redis in standard repositories:

```bash
# [GODADDY VPS SSH TERMINAL]
sudo apt update && sudo apt upgrade -y

sudo apt install -y \
    nginx \
    redis-server \
    mysql-server \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    pkg-config \
    libmysqlclient-dev \
    libssl-dev \
    libjpeg-dev \
    zlib1g-dev \
    git \
    curl \
    certbot \
    python3-certbot-nginx
```
*What it does:* Installs the C compilers, MySQL client development headers, image libraries, and web services required to run the Django API.

---

## Step 6: Install Node.js 22+ LTS (or 24 LTS) & PM2

Next.js 15 fully supports Node.js 22 LTS (Active Long Term Support) and Node.js 24:

```bash
# [GODADDY VPS SSH TERMINAL]
# Install official NodeSource Node.js 22.x LTS repository
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v   # Expected: v22.x.x (or v24.x.x)
npm -v    # Expected: 10.x.x or 11.x.x

# Install PM2 process manager globally
sudo npm install -g pm2
```
*(Note: To install Node.js 24 instead, replace `setup_22.x` with `setup_24.x`).*

---

## Step 7: Configure Redis Cache & Rate-Limiting

Harden Redis to listen only on localhost with memory caps:

```bash
# [GODADDY VPS SSH TERMINAL]
# Generate a strong random password for Redis
REDIS_PW=$(openssl rand -hex 24)
echo "Generated Redis Password: ${REDIS_PW}"

# Edit Redis configuration
sudo sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
sudo sed -i 's/^protected-mode no/protected-mode yes/' /etc/redis/redis.conf
sudo sed -i "s/^# requirepass foobared/requirepass ${REDIS_PW}/" /etc/redis/redis.conf

# Add memory limits at the end of redis.conf
# Note on eviction: volatile-lru evicts expired/idle catalog cache keys first,
# protecting active login-throttle counters from premature eviction under memory pressure.
sudo bash -c 'cat <<EOF >> /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy volatile-lru
appendonly no
EOF'

# Restart and enable Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test Redis connectivity
redis-cli -a "${REDIS_PW}" ping   # Expected output: PONG
```

---

## Step 8: Configure MySQL 8 Production Database

Create the database, user, and secure root credentials:

```bash
# [GODADDY VPS SSH TERMINAL]
# Generate a secure database password
DB_PW=$(openssl rand -hex 24)
echo "Generated MySQL Database Password: ${DB_PW}"

# Create MySQL database and dedicated user
sudo mysql -e "
CREATE DATABASE mmsr_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mmsr_user'@'localhost' IDENTIFIED BY '${DB_PW}';
GRANT ALL PRIVILEGES ON mmsr_db.* TO 'mmsr_user'@'localhost';
FLUSH PRIVILEGES;
"

# 1. Create secure client configuration file for root (used strictly by root daily backup cron)
sudo bash -c "cat <<EOF > /root/.my.cnf
[client]
user=mmsr_user
password=${DB_PW}
host=127.0.0.1
EOF"
sudo chmod 600 /root/.my.cnf

# 2. Create secure client configuration file for mmsr_admin deployer user
# (mmsr_admin cannot read /root/.my.cnf because /root has directory permission 700)
sudo bash -c "cat <<EOF > /home/mmsr_admin/.my.cnf
[client]
user=mmsr_user
password=${DB_PW}
host=127.0.0.1
EOF"
sudo chown mmsr_admin:mmsr_admin /home/mmsr_admin/.my.cnf
sudo chmod 600 /home/mmsr_admin/.my.cnf

# NOTE on new SSH sessions:
# If you log in as mmsr_admin in a separate terminal where ${DB_PW} is not in scope,
# you can verify or edit /home/mmsr_admin/.my.cnf using:
#   nano /home/mmsr_admin/.my.cnf
# Ensure it contains user=mmsr_user, your database password, and host=127.0.0.1.

# 3. Test deployer login without exposing password in terminal history:
mysql --defaults-extra-file=/home/mmsr_admin/.my.cnf -e "SHOW TABLES IN mmsr_db;"
```

---

## Step 9: Transfer Project Files from Windows to VPS

Prepare the directory on the VPS and transfer code and media:

```bash
# [GODADDY VPS SSH TERMINAL]
# Create application root directory
sudo mkdir -p /var/www/mmsr-v2
sudo chown -R mmsr_admin:www-data /var/www/mmsr-v2
sudo chmod -R 775 /var/www/mmsr-v2
```

From your local Windows PC, copy the codebase and both media folders:

```powershell
# [LOCAL WINDOWS POWERSHELL]
# 1. Export database records from your local SQLite into a clean JSON fixture
#
# CRITICAL: Do NOT use --natural-primary with this project.
# The custom users.User.natural_key() returns only the email address (username),
# omitting the integer primary key. When --natural-primary is passed, Django strips
# the numeric PK from every User record in the fixture. On loaddata into MySQL,
# Django re-assigns brand-new IDs, silently breaking every FK that references users:
#   orders_order.user_id, users_adminauditevent.user_id,
#   users_admininvitation.created_by_id, token_blacklist_outstandingtoken.user_id,
#   core_adminprofile.user_id, policies_policyacceptance.user_id,
#   submissions_submission.user_id, conferences_conferencesubmission.user_id,
#   publications_userjournalaccess.user_id
#
# --natural-foreign IS kept: resolves cross-app ContentType references without
# relying on hard-coded integer IDs from the SQLite migration history.
#
# WINDOWS UTF-8 ENCODING:
# $env:PYTHONUTF8 = "1" forces Python on Windows to output strict UTF-8. Without this,
# Python defaults to the Windows ANSI code page (cp1252), which corrupts characters
# like en-dashes and quotes, causing loaddata on Linux to crash with UnicodeDecodeError.
#
$env:PYTHONUTF8 = "1"
python backend/manage.py dumpdata --natural-foreign `
  -e contenttypes `
  -e auth.Permission `
  -e sessions `
  --indent 2 `
  -o backend/mmsr_migration_data.json

# 2. Upload project files to the VPS
#
# TRANSFER RULES — WHAT TO INCLUDE & EXCLUDE:
# MUST TRANSFER:
#   - All backend code, templates, and apps (core, users, orders, publications, etc.)
#   - backend/mmsr_migration_data.json (generated in step 1 above)
#   - backend/requirements.txt, backend/gunicorn.conf.py
#   - backend/media/ (public media: 21 files, ~19 MB)
#   - backend/protected_media/ (protected media: 2,761 files, ~528 MB)
#   - Frontend source: src/, app/, components/, public/, package.json, package-lock.json, next.config.ts
#
# NEVER TRANSFER (Must be excluded):
#   - node_modules/         (reinstalled cleanly on VPS via npm ci)
#   - .next/                (rebuilt cleanly on VPS via npm run build)
#   - backend/venv/         (recreated cleanly on Linux via python3 -m venv venv)
#   - backend/db_v2.sqlite3 (NEVER transfer: production uses MySQL 8 via fixture)
#   - __pycache__/          (transient python bytecode)
#   - backend/.env          (NEVER transfer: created fresh on VPS in Step 11)

### METHOD A: WinSCP (Recommended Windows GUI — Easiest for 528 MB Media)
# 1. Download and open WinSCP (https://winscp.net).
# 2. Connect via SFTP: Host = YOUR_GODADDY_VPS_IP, Port = 22, User = mmsr_admin.
# 3. Navigate remote directory to /var/www/mmsr-v2/.
# 4. In WinSCP Transfer Options, add file masks to exclude:
#    node_modules/; .next/; venv/; __pycache__/; *.sqlite3; .env
# 5. Drag and drop the project root into /var/www/mmsr-v2/.
# 6. Verify that backend/media/ and backend/protected_media/ upload completely.

### METHOD B: OpenSSH scp -r (Built into Windows 10/11 PowerShell — No Extra Tools)
```powershell
# [LOCAL WINDOWS POWERSHELL]
# 1. Upload root project files (package.json, lockfile, Next.js config)
scp package.json package-lock.json next.config.ts mmsr_admin@YOUR_GODADDY_VPS_IP:/var/www/mmsr-v2/

# 2. Upload frontend source directories (if present at root)
scp -r src app components public mmsr_admin@YOUR_GODADDY_VPS_IP:/var/www/mmsr-v2/ 2>$null

# 3. Upload backend code and fixture (excluding sqlite and venv)
scp -r backend\core backend\users backend\orders backend\publications backend\conferences `
  backend\submissions backend\policies backend\slider backend\templates backend\static `
  backend\config backend\requirements.txt backend\gunicorn.conf.py backend\manage.py `
  backend\mmsr_migration_data.json `
  mmsr_admin@YOUR_GODADDY_VPS_IP:/var/www/mmsr-v2/backend/

# 4. Upload media folders separately to preserve exact folder hierarchy
scp -r backend\media mmsr_admin@YOUR_GODADDY_VPS_IP:/var/www/mmsr-v2/backend/
scp -r backend\protected_media mmsr_admin@YOUR_GODADDY_VPS_IP:/var/www/mmsr-v2/backend/
```

### METHOD C: cwRsync (If rsync is installed via winget install cwRsync.cwRsync)
```powershell
# [LOCAL WINDOWS POWERSHELL]
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude 'venv' --exclude '__pycache__' --exclude 'db_v2.sqlite3' --exclude '.env' `
  ./ mmsr_admin@YOUR_GODADDY_VPS_IP:/var/www/mmsr-v2/

rsync -avz backend/media/ mmsr_admin@YOUR_GODADDY_VPS_IP:/var/www/mmsr-v2/backend/media/
rsync -avz backend/protected_media/ mmsr_admin@YOUR_GODADDY_VPS_IP:/var/www/mmsr-v2/backend/protected_media/
```

### POST-TRANSFER VERIFICATION ON VPS:
```bash
# [GODADDY VPS SSH TERMINAL]
# Verify file counts match local Windows counts:
find /var/www/mmsr-v2/backend/media -type f | wc -l
# Expected: 21 files

find /var/www/mmsr-v2/backend/protected_media -type f | wc -l
# Expected: 2761 files

# Confirm SQLite database was NOT transferred:
test -f /var/www/mmsr-v2/backend/db_v2.sqlite3 && echo "ERROR: SQLite found!" || echo "OK: SQLite safely excluded"
```

---

## Step 10: Setup Backend Virtual Environment & Dependencies

```bash
# [GODADDY VPS SSH TERMINAL]
cd /var/www/mmsr-v2
python3 -m venv venv
source venv/bin/activate

# Upgrade pip and install all production packages
pip install --upgrade pip
pip install -r backend/requirements.txt
```

---

## Step 11: Configure Backend Environment Variables (`backend/.env`)

Create `/var/www/mmsr-v2/backend/.env` on the VPS:

```ini
# ==========================================
# MMSR Publications - Production Environment
# ==========================================
SECRET_KEY=GENERATE_FRESH_SECRET_KEY_HERE
DEBUG=False
SEED_DEV_DATA=False

# HTTPS Bootstrap Setting (Temporary during initial setup):
# Set to False initially so Django does not redirect requests to HTTPS before
# Certbot has issued certificates in Step 17. Once Certbot succeeds, change to True.
SECURE_SSL_REDIRECT=False

# Canonical Domains
SITE_URL=https://mmsrpublications.org
SITE_DOMAIN=mmsrpublications.org
ALLOWED_HOSTS=localhost,127.0.0.1,mmsrpublications.org,www.mmsrpublications.org,api.mmsrpublications.org

# CORS & CSRF Settings
CORS_ALLOWED_ORIGINS=https://mmsrpublications.org,https://www.mmsrpublications.org,https://api.mmsrpublications.org
CSRF_TRUSTED_ORIGINS=https://mmsrpublications.org,https://www.mmsrpublications.org,https://api.mmsrpublications.org
FRONTEND_URL=https://mmsrpublications.org

# Database Credentials
DB_ENGINE=django.db.backends.mysql
DB_NAME=mmsr_db
DB_USER=mmsr_user
DB_PASSWORD=YOUR_GENERATED_MYSQL_PASSWORD
DB_HOST=127.0.0.1
DB_PORT=3306
DB_CONN_MAX_AGE=60

# Performance & Protected Media Offload (Phase 11C)
USE_X_ACCEL_REDIRECT=True
X_ACCEL_PREFIX=/protected_media_internal/

# Redis Cache
REDIS_URL=redis://:YOUR_GENERATED_REDIS_PASSWORD@127.0.0.1:6379/1

# Razorpay Test Mode Credentials
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_TEST_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_TEST_WEBHOOK_SECRET

# Email SMTP
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=mmsrpublications@gmail.com
EMAIL_HOST_PASSWORD=your_gmail_app_password
DEFAULT_FROM_EMAIL=MMSR Publications <mmsrpublications@gmail.com>
```

Generate a secure `SECRET_KEY` on the VPS:
```bash
# [GODADDY VPS SSH TERMINAL]
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## Step 12: Run Database Migrations, Fixture Import & Auto-Increment Sync

### 12a. Dry-Run Migration Test (MANDATORY before loading production data)

Run the full migration and fixture import into a **disposable test database** first.
This catches constraint errors and fixture problems before touching production data.

```bash
# [GODADDY VPS SSH TERMINAL]
# Create a temporary test database (completely separate from mmsr_db)
sudo mysql -e "CREATE DATABASE mmsr_test_migration CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "GRANT ALL PRIVILEGES ON mmsr_test_migration.* TO 'mmsr_user'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

cd /var/www/mmsr-v2/backend
source ../venv/bin/activate

# Point Django temporarily at the test database
export DB_NAME=mmsr_test_migration

# Run migrations into the test database
python manage.py migrate

# Load the fixture into the test database
python manage.py loaddata mmsr_migration_data.json

# Spot-check record counts in the test database (compare with SQLite counts)
mysql --defaults-extra-file=/home/mmsr_admin/.my.cnf mmsr_test_migration -e "
SELECT 'users' AS tbl, COUNT(*) AS rows FROM users_user
UNION ALL SELECT 'orders', COUNT(*) FROM orders_order
UNION ALL SELECT 'journal_access', COUNT(*) FROM publications_userjournalaccess
UNION ALL SELECT 'submissions', COUNT(*) FROM submissions_submission
UNION ALL SELECT 'conferences', COUNT(*) FROM conferences_conferencesubmission;
"

# If counts look correct, drop the test database and unset the override
unset DB_NAME
sudo mysql -e "DROP DATABASE mmsr_test_migration;"
echo 'Dry-run test PASSED. Safe to proceed to Step 12b (production loaddata).'
```

### 12b. Production Migration & Data Import

```bash
# [GODADDY VPS SSH TERMINAL]
cd /var/www/mmsr-v2/backend
source ../venv/bin/activate

# 1. Create clean database schema
python manage.py migrate

# 2. Load historical records from exported fixture
python manage.py loaddata mmsr_migration_data.json

# 3. Synchronize auto-increment sequences dynamically
mysql --defaults-extra-file=/home/mmsr_admin/.my.cnf mmsr_db << 'EOF'
ALTER TABLE `users_user` AUTO_INCREMENT = 39;
ALTER TABLE `users_admininvitation` AUTO_INCREMENT = 11;
ALTER TABLE `users_adminauditevent` AUTO_INCREMENT = 129;
ALTER TABLE `core_adminprofile` AUTO_INCREMENT = 6;
ALTER TABLE `orders_order` AUTO_INCREMENT = 118;
ALTER TABLE `orders_orderitem` AUTO_INCREMENT = 139;
ALTER TABLE `publications_category` AUTO_INCREMENT = 7;
ALTER TABLE `publications_book` AUTO_INCREMENT = 10;
ALTER TABLE `publications_journal` AUTO_INCREMENT = 6;
ALTER TABLE `publications_journalissue` AUTO_INCREMENT = 25;
ALTER TABLE `publications_journalarticle` AUTO_INCREMENT = 7;
ALTER TABLE `publications_userjournalaccess` AUTO_INCREMENT = 12;
ALTER TABLE `publications_bookchapter` AUTO_INCREMENT = 15;
ALTER TABLE `publications_chaptersection` AUTO_INCREMENT = 15;
ALTER TABLE `publications_chapterauthor` AUTO_INCREMENT = 5;
ALTER TABLE `publications_testimonial` AUTO_INCREMENT = 6;
ALTER TABLE `publications_sitemetrics` AUTO_INCREMENT = 2;
ALTER TABLE `publications_universitypartner` AUTO_INCREMENT = 8;
ALTER TABLE `publications_contactinquiry` AUTO_INCREMENT = 3;
ALTER TABLE `submissions_submission` AUTO_INCREMENT = 11;
ALTER TABLE `submissions_publishedvolume` AUTO_INCREMENT = 2;
ALTER TABLE `conferences_conference` AUTO_INCREMENT = 5;
ALTER TABLE `conferences_conferencesubmission` AUTO_INCREMENT = 17;
ALTER TABLE `conferences_conferencesubmissionauthor` AUTO_INCREMENT = 19;
ALTER TABLE `policies_policy` AUTO_INCREMENT = 4;
ALTER TABLE `slider_sliderimage` AUTO_INCREMENT = 5;
ALTER TABLE `token_blacklist_outstandingtoken` AUTO_INCREMENT = 32;
ALTER TABLE `token_blacklist_blacklistedtoken` AUTO_INCREMENT = 21;
ALTER TABLE `django_admin_log` AUTO_INCREMENT = 33;
EOF

# 4. Collect static files for Nginx
python manage.py collectstatic --noinput

# 5. Set strict media permissions
sudo chown -R www-data:www-data /var/www/mmsr-v2/backend/media
sudo chown -R www-data:www-data /var/www/mmsr-v2/backend/protected_media
sudo chmod -R 750 /var/www/mmsr-v2/backend/protected_media
sudo chmod -R 755 /var/www/mmsr-v2/backend/media
```

---

## Step 13: Configure Gunicorn Service (Systemd)

Create `/etc/systemd/system/mmsr-backend.service`:

```ini
[Unit]
Description=MMSR Publications Django Gunicorn Service
After=network.target mysql.service redis-server.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/mmsr-v2/backend
Environment="PATH=/var/www/mmsr-v2/venv/bin"
ExecStart=/var/www/mmsr-v2/venv/bin/gunicorn -c /var/www/mmsr-v2/backend/gunicorn.conf.py config.wsgi:application
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
# [GODADDY VPS SSH TERMINAL]
sudo systemctl daemon-reload
sudo systemctl enable --now mmsr-backend
sudo systemctl status mmsr-backend
```

---

## Step 14: Build & Start Next.js Frontend (PM2)

Configure `/var/www/mmsr-v2/.env.local`:
```ini
NEXT_PUBLIC_API_URL=https://api.mmsrpublications.org
NEXT_PUBLIC_SITE_URL=https://mmsrpublications.org
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
```

Build and launch the process:
```bash
# [GODADDY VPS SSH TERMINAL]
cd /var/www/mmsr-v2
npm ci
npm run build

# Start with PM2
pm2 start npm --name "mmsr-frontend" -- start -- -p 3000
pm2 save
pm2 startup
```

---

## Step 15: Configure Initial HTTP Nginx Bootstrap Reverse Proxy

> [!IMPORTANT]
> **BOOTSTRAP SEQUENCING NOTE:**  
> Nginx must start on **HTTP Port 80 first** so that:
> 1. `sudo nginx -t` passes immediately without failing due to nonexistent SSL certificates.
> 2. Certbot in Step 17 can complete the ACME HTTP-01 challenge verification over Port 80.
> Certbot will automatically obtain certificates, configure the Port 443 HTTPS blocks, and add the HTTP-to-HTTPS redirects.

Create `/etc/nginx/sites-available/mmsr`:

```nginx
# 1. Frontend Bootstrap (HTTP Port 80): mmsrpublications.org & www.mmsrpublications.org
server {
    listen 80;
    server_name mmsrpublications.org www.mmsrpublications.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. Backend API Bootstrap (HTTP Port 80): api.mmsrpublications.org
server {
    listen 80;
    server_name api.mmsrpublications.org;

    # Allow 12MB uploads for author manuscripts
    client_max_body_size 12M;

    # 120s timeouts for PDF generation and large uploads
    proxy_connect_timeout 60s;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets
    location /static/ {
        alias /var/www/mmsr-v2/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # Public marketing assets allowlist (Covers, samples, slider images)
    location ~ ^/media/(books/(covers|samples)|journals/(covers|issues)|conferences/(covers|banners)|slider|testimonials/avatars|profile_pics|volumes/covers|authors/photos|categories)/ {
        root /var/www/mmsr-v2/backend;
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    # Strict isolation: Invoices and private manuscripts return 404!
    location /media/ {
        return 404;
    }

    # Internal protected media streaming (Django X-Accel-Redirect offload)
    # Accessible ONLY via internal Django responses — direct public requests return 404!
    location /protected_media_internal/ {
        internal;
        alias /var/www/mmsr-v2/backend/protected_media/;
    }
}
```

Enable site and start Nginx:
```bash
# [GODADDY VPS SSH TERMINAL]
sudo ln -sf /etc/nginx/sites-available/mmsr /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verify HTTP syntax (Expected: syntax is ok, test is successful)
sudo nginx -t

# Reload Nginx service
sudo systemctl reload nginx
```

---

## Step 16: DNS Setup Instructions (Requires Owner Approval)

Log in to your domain DNS registrar (GoDaddy DNS Management) and create the following **A Records**:

| Type | Name / Host | Value / Target | TTL |
|---|---|---|---|
| **A** | `@` | `YOUR_GODADDY_VPS_IP` | 600 seconds (10 min) |
| **A** | `www` | `YOUR_GODADDY_VPS_IP` | 600 seconds (10 min) |
| **A** | `api` | `YOUR_GODADDY_VPS_IP` | 600 seconds (10 min) |

*Important:* Wait 10 to 30 minutes for DNS propagation before running Certbot in Step 17.

---

## Step 17: Obtain Free SSL Certificates (Certbot Let's Encrypt) & Hardening

Once DNS has propagated (Step 16) and Nginx is running on Port 80 (Step 15), run Certbot:

```bash
# [GODADDY VPS SSH TERMINAL]
# 1. Run Certbot with Nginx plugin for all three domains
sudo certbot --nginx -d mmsrpublications.org -d www.mmsrpublications.org -d api.mmsrpublications.org
```

*What Certbot does:*
- Solves the HTTP-01 ACME challenge using the active Port 80 Nginx server.
- Automatically creates the SSL/TLS configuration blocks on Port 443 with the Let's Encrypt certificates.
- Automatically adds HTTP-to-HTTPS (301) redirection rules.
- Installs the systemd auto-renewal timer (`certbot.timer`).

### Post-Certbot Verification & Security Header Hardening:
Inspect `/etc/nginx/sites-available/mmsr` to confirm that the Port 443 server blocks contain:
- `ssl_certificate /etc/letsencrypt/live/mmsrpublications.org/fullchain.pem;`
- `ssl_certificate_key /etc/letsencrypt/live/mmsrpublications.org/privkey.pem;`
- `proxy_set_header X-Forwarded-Proto https;` (overwriting forwarded protocol for Django's `SECURE_PROXY_SSL_HEADER`)
- Production security headers:
  ```nginx
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  ```

Test and reload Nginx:
```bash
# [GODADDY VPS SSH TERMINAL]
sudo nginx -t
sudo systemctl reload nginx
```

### Activate Django HTTPS Redirect:
Now that SSL certificates are active and Nginx is serving HTTPS on Port 443, enable Django's production HTTPS enforcement:

> [!WARNING]
> **CRITICAL GUARD:** If Certbot failed or HTTPS is not working in your browser, **DO NOT** enable `SECURE_SSL_REDIRECT=True` yet. Resolve the domain DNS or Nginx certificate issue first. Only proceed once Port 443 is serving valid certificates.

```bash
# [GODADDY VPS SSH TERMINAL]
# 1. Edit production environment file
nano /var/www/mmsr-v2/backend/.env

# 2. Change the bootstrap setting:
#    Change: SECURE_SSL_REDIRECT=False
#    To:     SECURE_SSL_REDIRECT=True

# 3. Restart Gunicorn to apply production HTTPS redirection
sudo systemctl restart mmsr-backend

# 4. Verify API health endpoint over HTTPS:
curl -i https://api.mmsrpublications.org/api/health/
# Expected: HTTP/2 200 OK -> {"status":"ok"}

# 5. Verify plain HTTP automatically redirects to HTTPS:
curl -i http://api.mmsrpublications.org/api/health/
# Expected: HTTP/1.1 301 Moved Permanently -> Location: https://api.mmsrpublications.org/api/health/
```

---

## Step 18: Setup Automated Daily Backups

Install the hardened, atomic backup script with concurrency locking (`flock`) and integrity testing (`gzip -t`):

```bash
# [GODADDY VPS SSH TERMINAL]
sudo bash -c 'cat << "EOF" > /usr/local/bin/mmsr_backup.sh
#!/usr/bin/env bash
# ==============================================================================
# MMSR Publications V2 — Hardened Automated Production Backup Script
# Features: flock concurrency lock, pipefail error trap, atomic tmp files, gzip -t
# ==============================================================================
set -eo pipefail

LOCK_FILE="/var/run/mmsr_backup.lock"
exec 200>"${LOCK_FILE}"
flock -n 200 || { echo "[$(date)] Backup already in progress. Exiting." >&2; exit 1; }

BACKUP_DIR="/var/backups/mmsr"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
APP_DIR="/var/www/mmsr-v2/backend"
LOG_FILE="/var/log/mmsr_backup.log"
MY_CNF="/root/.my.cnf"

mkdir -p "${BACKUP_DIR}"
echo "[$(date)] Starting MMSR daily backup (Timestamp: ${TIMESTAMP})..." >> "${LOG_FILE}"

# 1. Atomic MySQL Database Dump (InnoDB transactional snapshot)
DB_TMP="${BACKUP_DIR}/mmsr_db_${TIMESTAMP}.sql.gz.tmp"
DB_FINAL="${BACKUP_DIR}/mmsr_db_${TIMESTAMP}.sql.gz"

mysqldump --defaults-extra-file="${MY_CNF}"     --single-transaction     --quick     --routines     --triggers     mmsr_db | gzip -9 > "${DB_TMP}"

# Integrity verification: test gzip decompression before promoting
gzip -t "${DB_TMP}" || { echo "[$(date)] CRITICAL: Database backup corrupted!" >> "${LOG_FILE}"; rm -f "${DB_TMP}"; exit 1; }
mv "${DB_TMP}" "${DB_FINAL}"
echo "[$(date)] MySQL backup verified & saved: ${DB_FINAL}" >> "${LOG_FILE}"

# 2. Atomic Protected Media Archive (Invoices, Manuscripts, Certificates)
PM_TMP="${BACKUP_DIR}/mmsr_protected_media_${TIMESTAMP}.tar.gz.tmp"
PM_FINAL="${BACKUP_DIR}/mmsr_protected_media_${TIMESTAMP}.tar.gz"
tar -czf "${PM_TMP}" -C "${APP_DIR}" protected_media
gzip -t "${PM_TMP}" || { echo "[$(date)] CRITICAL: Protected media archive corrupted!" >> "${LOG_FILE}"; rm -f "${PM_TMP}"; exit 1; }
mv "${PM_TMP}" "${PM_FINAL}"
echo "[$(date)] Protected media backup verified & saved: ${PM_FINAL}" >> "${LOG_FILE}"

# 3. Atomic Public Media Archive (Covers, Sliders, Avatars)
PUB_TMP="${BACKUP_DIR}/mmsr_public_media_${TIMESTAMP}.tar.gz.tmp"
PUB_FINAL="${BACKUP_DIR}/mmsr_public_media_${TIMESTAMP}.tar.gz"
tar -czf "${PUB_TMP}" -C "${APP_DIR}" media
gzip -t "${PUB_TMP}" || { echo "[$(date)] CRITICAL: Public media archive corrupted!" >> "${LOG_FILE}"; rm -f "${PUB_TMP}"; exit 1; }
mv "${PUB_TMP}" "${PUB_FINAL}"
echo "[$(date)] Public media backup verified & saved: ${PUB_FINAL}" >> "${LOG_FILE}"

# 4. Rotation: Purge backups older than 14 days
find "${BACKUP_DIR}" -type f -name "mmsr_*.gz" -mtime +14 -delete
echo "[$(date)] Daily backup completed successfully (14-day retention enforced)." >> "${LOG_FILE}"
EOF'

sudo chmod 700 /usr/local/bin/mmsr_backup.sh

# Add to crontab with lock (runs daily at 2:00 AM)
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/mmsr_backup.sh") | sudo crontab -

# Add Background Invoice & Email Job Recovery Cron (runs every 5 minutes as www-data)
sudo mkdir -p /var/log/mmsr
sudo chown www-data:www-data /var/log/mmsr
(sudo -u www-data crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/mmsr-v2/venv/bin/python /var/www/mmsr-v2/backend/manage.py recover_invoice_jobs >> /var/log/mmsr/recover_invoice_jobs.log 2>&1") | sudo -u www-data crontab -
```

### Background Processing & Outbox Architecture (Phase 11G Hardened)

1. **Strict Transactional Outbox Atomicity (`InvoiceJob`):**
   - Every confirmed payment (`verify_razorpay`, `check_qr_payment`, `RazorpayWebhookView._handle_payment_success`) updates `Order.status = 'paid'` and calls `InvoiceJob.objects.get_or_create()` **inside the exact same `with transaction.atomic():` block**.
   - Immediate dispatch is registered via `transaction.on_commit(lambda: dispatch_invoice_job(job_id))` inside the transaction, ensuring that rollback completely cancels both the order status flip and job dispatch.
   - The HTTP response to Razorpay completes in milliseconds without blocking on ReportLab PDF generation or SMTP email transmission.

2. **Atomic Concurrency Claiming, Retry Cooldown & Crash Recovery (`recover_invoice_jobs`):**
   - **Atomic Conditional Claiming:** Workers claim jobs via atomic conditional SQL `update(status=STATUS_RUNNING, attempts=F('attempts') + 1)` filtering for `status__in=['pending', 'failed']`. Concurrent workers or overlapping crons will obtain 0 claimed rows and exit immediately without duplicate processing.
   - **Retry Cooldown Calculated from `updated_at` (Phase 11I):** Eligibility for pending and failed jobs is evaluated strictly against `updated_at <= now - older_than_seconds` (default 60s). Failed jobs must wait for the full cooldown period to elapse from their last update before being retried; an older job that failed recently cannot bypass the cooldown.
   - **Stale Running Crash Recovery (Lease Timeout):** If Gunicorn is SIGKILLed or crashes mid-execution while a job is marked `running`, the recovery command reclaims jobs whose lease has expired (`updated_at <= now - 300s`), resets them to `pending`, and re-dispatches them. Recently updated running jobs remain protected from premature reclamation.
   - **SMTP Timeout (30 seconds):** `EMAIL_TIMEOUT = 30` is enforced in settings, limiting SMTP connection and socket I/O duration. A stalled mail server will fail fast after 30 seconds (well within the 300-second stale lease) rather than blocking a background thread indefinitely. Note: this bounds email connection operations only; PDF generation time is not limited by this setting.
   - **Independent Retry Idempotency & Delivery Semantics:** Invoice PDF creation and SMTP delivery have independent flags (`invoice_generated`, `email_sent`). Once generated, retries never re-render the PDF. Delivery is *at-most-once* from the SMTP provider perspective: if a provider accepts a message but connection drops before acknowledgment, `email_sent` remains False and a retry will resend. Delivery cannot be characterized as strictly exactly-once.
   - **Mandatory VPS Recovery Cron Configuration & Smoke Testing:** The recovery cron MUST be configured in crontab for `www-data` and tested on the staging VPS:
     ```bash
     # Test manual execution on VPS
     /var/www/mmsr-v2/venv/bin/python /var/www/mmsr-v2/backend/manage.py recover_invoice_jobs --older-than 60 --stale-running-seconds 300 --max-attempts 5
     ```

3. **Universal Protected Media Offloading (Nginx X-Accel-Redirect):**
   - Customer and author documents are isolated in `/var/www/mmsr-v2/protected_media/` (`chmod 700`, owned by `www-data:www-data`).
   - All download endpoints enforce Django-level authorization and permission checks:
     - Book PDFs (`/api/publications/books/{id}/pdf/`)
     - Journal Issue PDFs (`/api/publications/issues/{id}/pdf/`)
     - Journal Article PDFs (`/api/publications/articles/{id}/pdf/`)
     - Order Invoices (`/api/commerce/{id}/invoice/`)
     - Conference Manuscripts (`/api/conference-submissions/{id}/manuscript/`)
     - Conference Invoices (`/api/conference-submissions/{id}/invoice/`)
   - In production (`USE_X_ACCEL_REDIRECT=True`), Django responds with an empty body and `X-Accel-Redirect: /protected_media_internal/<path>`. Nginx offloads disk-to-network streaming via kernel `sendfile`, freeing Gunicorn worker threads instantly.

4. **Automated WebP Image Pipeline & Change-Detection Lifecycle:**
   - Public images uploaded to Books, Journals, Journal Issues, Chapter Authors, Published Volumes, Slider Images, and Conferences automatically generate full-size WebP and thumbnail WebP variants (`.webp` and `_thumb.webp`).
   - Signal lifecycle uses `pre_save` image change tracking: model updates (e.g. price change, status update, description edit) verify that the image filename is unchanged and that variants exist on disk, completely skipping redundant image re-processing.

3. **Optional Celery Worker Architecture (High-Volume Horizontal Scaling):**
   - When traffic scales beyond single-server threading capacity, Celery can be enabled:
     - Install: `pip install celery`
     - Broker: configure isolated Redis database: `CELERY_BROKER_URL=redis://127.0.0.1:6379/1` (DB 1 reserved for Celery; DB 0 reserved for Django cache).
     - Worker Systemd service (`/etc/systemd/system/mmsr-celery.service`):
       ```ini
       [Unit]
       Description=MMSR Celery Worker
       After=network.target redis-server.service

       [Service]
       Type=simple
       User=www-data
       Group=www-data
       WorkingDirectory=/var/www/mmsr-v2/backend
       EnvironmentFile=/var/www/mmsr-v2/backend/.env
       ExecStart=/var/www/mmsr-v2/venv/bin/celery -A config worker -l info --concurrency=2
       Restart=always
       RestartSec=10

       [Install]
       WantedBy=multi-user.target
       ```
   - Note: Threaded outbox + recovery cron is the recommended default for initial 8 GB VPS deployment. Celery worker is an optional scaling upgrade.

---

## Step 19: Deployment Smoke Test Checklist

Once the server is running, execute these smoke tests:

```bash
# [LOCAL WINDOWS POWERSHELL or BROWSER]
# 1. Health Probe
curl -i https://api.mmsrpublications.org/api/health/
# Expected: HTTP/2 200 OK -> {"status":"ok"}

# 2. Media Isolation Test (Direct invoice access must return 404)
curl -i https://api.mmsrpublications.org/media/invoices/test.pdf
# Expected: HTTP/2 404 Not Found

# 3. Public Media Test (Book cover must return 200)
curl -i https://api.mmsrpublications.org/media/slider/mmsr_slide1.png
# Expected: HTTP/2 200 OK

# 4. Razorpay Webhook Reachability Test
curl -i -X POST https://api.mmsrpublications.org/api/commerce/webhook/
# Expected: HTTP/2 400 Bad Request -> {"error":"Missing webhook signature"}
```

---

## Step 20: Rollback Procedure

If any issue occurs during deployment:
```bash
# [GODADDY VPS SSH TERMINAL]
# 1. Restore MySQL database (run as mmsr_admin using deployer client config, or as root using /root/.my.cnf)
gunzip < /var/backups/mmsr/mmsr_db_TARGET_TIMESTAMP.sql.gz | mysql --defaults-extra-file=/home/mmsr_admin/.my.cnf mmsr_db

# 2. Restart services
sudo systemctl restart mmsr-backend
pm2 restart mmsr-frontend
sudo systemctl reload nginx
```

