"""
MMSR Publications V2 — Production Gunicorn Configuration
======================================================
This configuration is loaded automatically by Gunicorn when starting the WSGI server:
    gunicorn -c gunicorn.conf.py config.wsgi:application
"""
import os
import multiprocessing

# Network Binding: Bind strictly to internal loopback (Nginx reverse-proxies to this port)
bind = os.environ.get("GUNICORN_BIND", "127.0.0.1:8000")

# Worker Processes: 4 workers provide optimal concurrency for a 4 vCPU / 8 GB RAM VPS
# Standard formula: 2 * vCPUs + 1 (or dedicated 4 workers)
workers = int(os.environ.get("GUNICORN_WORKERS", 4))
worker_class = "sync"

# Request Timeout: 120 seconds accommodates ReportLab multi-page PDF generation
# and large 10 MB author manuscript uploads without triggering 30s timeout kills
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 120))
keepalive = 5

# Memory Leak Protection (Worker Recycling):
# Gracefully restarts workers after processing requests to prevent memory bloat over time.
# Jitter prevents all 4 workers from restarting simultaneously.
max_requests = 1000
max_requests_jitter = 100

# Process Naming
proc_name = "mmsr_gunicorn"

# Logging:
# Default to "-" (stdout/stderr) so systemd / journald captures all logs cleanly:
#   sudo journalctl -u mmsr-backend -f
# To use file-based logging, set GUNICORN_ACCESS_LOG and GUNICORN_ERROR_LOG in your environment.
accesslog = os.environ.get("GUNICORN_ACCESS_LOG", "-")
errorlog = os.environ.get("GUNICORN_ERROR_LOG", "-")
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")

# Capture request timing and proxy headers for observability
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)sµs'

