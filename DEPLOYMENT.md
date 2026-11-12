> [!IMPORTANT]
> **CANONICAL PRODUCTION GUIDE NOTICE:**
> This generic `DEPLOYMENT.md` document has been superseded. For official pre-purchase specifications, Ubuntu 24.04 LTS installation commands, GoDaddy VPS hardware requirements, systemd services, automated backup scripts, and disaster recovery runbooks, refer strictly to the authoritative guide:
> **[`GODADDY_DEPLOYMENT_GUIDE.md`](./GODADDY_DEPLOYMENT_GUIDE.md)**.
> All production deployment and staging operations must use `GODADDY_DEPLOYMENT_GUIDE.md`.

# MMSR Publications V2 — Production Deployment Guide

This document describes the environment, dependencies, configuration, and verification steps required to deploy the **MMSR Publications V2** platform to production on a Linux VPS (Ubuntu 22.04 LTS).

---

## 1. System Requirements & Architecture

MMSR V2 is composed of:
1. **Frontend**: Next.js 15 (React 19, TypeScript, Tailwind CSS) running in Node.js 20+ via PM2 on port `3000`.
2. **Backend**: Django 4.2 REST API running via Gunicorn (4 workers) on port `8000`.
3. **Database**: MySQL 5.7+ or 8.0 (InnoDB engine required for atomic transactions and relational constraints).
4. **Cache & Rate-Limiting**: Redis 6+ running locally on port `6379`.
5. **Reverse Proxy & TLS**: Nginx terminating SSL (Certbot Let's Encrypt), proxying requests, and enforcing security headers.

> [!WARNING]
> **Hosting Requirement:** This application **cannot run on basic GoDaddy Shared cPanel Hosting**. It requires a **GoDaddy Linux VPS** (or equivalent cloud server: 2 vCPU, 4GB RAM minimum) to host the persistent Node.js, Python Gunicorn, and Redis daemons.

---

## 2. Server Provisioning & OS Setup (Ubuntu 22.04 LTS)

### A. Install Node.js 20+ (LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pm2
node -v  # Verify v20+
```

### B. Install Python & MySQL Build Dependencies
`mysqlclient` and cryptographic libraries require C headers and build tools:
```bash
sudo apt-get update && sudo apt-get install -y \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    pkg-config \
    libmysqlclient-dev \
    libssl-dev \
    libjpeg-dev \
    zlib1g-dev \
    redis-server \
    nginx \
    certbot \
    python3-certbot-nginx
```

### C. Configure UFW Firewall
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

---

## 3. Database Setup (MySQL 8.0)

```sql
CREATE DATABASE mmsr_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mmsr_user'@'localhost' IDENTIFIED BY 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON mmsr_db.* TO 'mmsr_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## 4. Backend Deployment (Django)

1. Clone or copy code to `/var/www/mmsr-v2`.
2. Create and activate virtual environment:
   ```bash
   cd /var/www/mmsr-v2
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```
3. Configure `/var/www/mmsr-v2/backend/.env`:
   ```ini
   DEBUG=False
   SECRET_KEY=YOUR_PRODUCTION_SECRET_KEY
   SITE_URL=https://mmsrpublications.org
   SITE_DOMAIN=mmsrpublications.org
   ALLOWED_HOSTS=localhost,127.0.0.1,mmsrpublications.org,www.mmsrpublications.org,api.mmsrpublications.org
   CORS_ALLOWED_ORIGINS=https://mmsrpublications.org,https://www.mmsrpublications.org
   CSRF_TRUSTED_ORIGINS=https://mmsrpublications.org,https://www.mmsrpublications.org,https://api.mmsrpublications.org
   FRONTEND_URL=https://mmsrpublications.org
   DB_ENGINE=django.db.backends.mysql
   DB_NAME=mmsr_db
   DB_USER=mmsr_user
   DB_PASSWORD=YOUR_SECURE_PASSWORD
   DB_HOST=127.0.0.1
   DB_PORT=3306
   REDIS_URL=redis://127.0.0.1:6379/1
   SEED_DEV_DATA=False
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_razorpay_live_secret
   RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
   ```
4. Run migrations and collect static assets:
   ```bash
   python backend/manage.py migrate
   python backend/manage.py collectstatic --noinput
   ```
5. Create Systemd Service `/etc/systemd/system/mmsr-backend.service`:
   ```ini
   [Unit]
   Description=MMSR Publications Django Gunicorn Service
   After=network.target mysql.service redis-server.service

   [Service]
   User=www-data
   Group=www-data
   WorkingDirectory=/var/www/mmsr-v2/backend
   ExecStart=/var/www/mmsr-v2/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:8000 config.wsgi:application
   Restart=always
   RestartSec=3

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now mmsr-backend
   sudo systemctl status mmsr-backend
   ```

---

## 5. Frontend Deployment (Next.js)

1. Configure `/var/www/mmsr-v2/.env.local`:
   ```ini
   NEXT_PUBLIC_API_URL=https://api.mmsrpublications.org
   NEXT_PUBLIC_SITE_URL=https://mmsrpublications.org
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
   ```
2. Build and run via PM2:
   ```bash
   cd /var/www/mmsr-v2
   npm ci
   npm run build
   pm2 start npm --name "mmsr-frontend" -- start -- -p 3000
   pm2 save
   pm2 startup
   ```

---

## 6. Nginx Reverse Proxy, Media Isolation & Body Size

Create `/etc/nginx/sites-available/mmsr`:

```nginx
# 1. Frontend: mmsrpublications.org
server {
    listen 80;
    server_name mmsrpublications.org www.mmsrpublications.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mmsrpublications.org www.mmsrpublications.org;

    ssl_certificate /etc/letsencrypt/live/mmsrpublications.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mmsrpublications.org/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# 2. Backend API: api.mmsrpublications.org
server {
    listen 80;
    server_name api.mmsrpublications.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.mmsrpublications.org;

    ssl_certificate /etc/letsencrypt/live/mmsrpublications.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mmsrpublications.org/privkey.pem;

    # Allow up to 12MB uploads for author manuscripts & attachments
    client_max_body_size 12M;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Static assets
    location /static/ {
        alias /var/www/mmsr-v2/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # Public marketing assets only (Covers, samples, slider images)
    # Strictly isolates private invoices, certificates, and manuscripts!
    location ~ ^/media/(books/(covers|samples)|journals/(covers|issues)|conferences/(covers|banners)|slider|testimonials/avatars|profile_pics|volumes/covers|authors/photos|categories)/ {
        alias /var/www/mmsr-v2/backend/media/;
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    # Everything else under /media/ (including invoices and unpublished papers) returns 404!
    location /media/ {
        return 404;
    }
}
```

Enable configuration and test:
```bash
sudo ln -s /etc/nginx/sites-available/mmsr /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Database Backup & Restore Plan

### A. Automated Daily Backup (Cron)
Create `/var/backups/mmsr` and add a root cron job (`sudo crontab -e`):
```cron
# Daily MySQL backup at 2:00 AM (compressed with date tag)
0 2 * * * /usr/bin/mysqldump --single-transaction --quick -u mmsr_user -p'YOUR_SECURE_PASSWORD' mmsr_db | gzip > /var/backups/mmsr/mmsr_db_$(date +\%F).sql.gz

# Delete backups older than 14 days at 3:00 AM
0 3 * * * find /var/backups/mmsr -type f -name "mmsr_db_*.sql.gz" -mtime +14 -delete
```

### B. Tested Restore Procedure
If database recovery is required:
```bash
# 1. Decompress and restore specific snapshot
gunzip < /var/backups/mmsr/mmsr_db_YYYY-MM-DD.sql.gz | mysql -u mmsr_user -p'YOUR_SECURE_PASSWORD' mmsr_db

# 2. Restart backend service
sudo systemctl restart mmsr-backend
```

---

## 8. Post-Deployment Smoke Test Checklist

- [ ] Uptime health probe returns HTTP 200:
  ```bash
  curl -s https://api.mmsrpublications.org/api/health/
  # Expected output: {"status":"ok"}
  ```
- [ ] Confirm public media isolation:
  - Visiting an uploaded invoice path directly (e.g. `https://api.mmsrpublications.org/media/invoices/...`) returns **HTTP 404**.
  - Authorised invoices stream exclusively via authenticated API view `/api/commerce/<id>/invoice/`.
- [ ] Large file uploads (manuscripts up to 10MB) succeed without Nginx `413 Request Entity Too Large` error.
- [ ] Test order creation & Razorpay payment signature verification.
- [ ] Verify test webhook callback reaches `https://api.mmsrpublications.org/api/commerce/webhook/` with HTTP 200.
