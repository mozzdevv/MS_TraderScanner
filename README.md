# ⚡ Stock Momentum Scanner

Real-time stock momentum detection and alerting dashboard. Tracks rapid price jumps on US stocks and sends instant notifications to Discord.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Local Development](#local-development)
- [Docker Deployment (VPS / Cloud)](#docker-deployment-vps--cloud)
  - [1. Provision a VPS](#1-provision-a-vps)
  - [2. SSH Into Your Server](#2-ssh-into-your-server)
  - [3. Install Docker & Docker Compose](#3-install-docker--docker-compose)
  - [4. Clone the Repository](#4-clone-the-repository)
  - [5. Configure for Your Server IP](#5-configure-for-your-server-ip)
  - [6. Build & Launch](#6-build--launch)
  - [7. Verify Everything Is Running](#7-verify-everything-is-running)
  - [8. Run 24/7 in the Background](#8-run-247-in-the-background)
  - [9. View Logs](#9-view-logs)
  - [10. Update the App](#10-update-the-app)
  - [11. Firewall Configuration](#11-firewall-configuration)
- [Configuration](#configuration)
- [How It Works](#how-it-works)
- [Troubleshooting](#troubleshooting)

---

## Overview

| Component | Technology |
|-----------|-----------|
| Backend | Python 3.12 + FastAPI + yfinance |
| Frontend | Next.js 14 + React |
| Database | SQLite (file-based, zero config) |
| Alerts | Discord Webhook |
| Deployment | Docker + Docker Compose |

## Features

- **Watchlist Manager** — Add/remove US stock ticker symbols
- **Polling Engine** — Fetches live prices every 5-10 seconds via yfinance (free)
- **Momentum Detection** — Detects when a stock jumps ≥ X% from its rolling window low
- **Discord Alerts** — Sends rich embed notifications to your phone via Discord webhook
- **Real-Time Dashboard** — WebSocket-powered live updates
- **Configurable** — Adjust threshold, time window, poll interval from the UI

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                       │
│                                                         │
│  ┌─────────────────┐     ┌──────────────────────────┐   │
│  │  scanner-frontend│     │   scanner-backend        │   │
│  │  (Next.js :3000) │────▶│   (FastAPI :8000)        │   │
│  └─────────────────┘     │                          │   │
│                          │  ┌──────────────────┐    │   │
│                          │  │ Polling Engine    │    │   │
│                          │  │ (yfinance)        │───────▶ Yahoo Finance
│                          │  └──────────────────┘    │   │
│                          │  ┌──────────────────┐    │   │
│                          │  │ SQLite DB         │    │   │
│                          │  │ (Docker volume)   │    │   │
│                          │  └──────────────────┘    │   │
│                          │  ┌──────────────────┐    │   │
│                          │  │ Discord Webhook   │───────▶ Your Phone
│                          │  └──────────────────┘    │   │
│                          └──────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Local Development

```bash
# Terminal 1: Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
# → Running on http://localhost:8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
# → Running on http://localhost:3000
```

---

## Docker Deployment (VPS / Cloud)

This section walks you through **every single step** from a fresh Ubuntu server to a running 24/7 scanner.

### 1. Provision a VPS

Get a free Linux VPS from one of these providers:

| Provider | Free Tier |
|----------|-----------|
| **Oracle Cloud** | Always Free — 1 VM, 1 GB RAM, 1 OCPU (ARM) |
| **Google Cloud** | e2-micro, 1 GB RAM, 30 GB disk (free tier) |
| **AWS** | t2.micro, 1 GB RAM (12-month free tier) |

**Minimum requirements:** 1 vCPU, 1 GB RAM, 10 GB disk, Ubuntu 22.04 or 24.04 LTS.

When creating the VM:
- Choose **Ubuntu 22.04 LTS** (or 24.04)
- Open ports **3000** (dashboard) and **8000** (API) in the security list / firewall rules
- Download the SSH key pair

---

### 2. SSH Into Your Server

```bash
# Replace with your VM's public IP and key file
ssh -i ~/your-key.pem ubuntu@YOUR_SERVER_IP
```

> **Oracle Cloud** uses `ubuntu` user. **GCP** uses your Google username. **AWS** uses `ubuntu` for Ubuntu AMIs.

---

### 3. Install Docker & Docker Compose

Run these commands **on your VPS**, one section at a time:

```bash
# ── Update system packages ────────────────────────────────────────
sudo apt update && sudo apt upgrade -y

# ── Install prerequisites ─────────────────────────────────────────
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git

# ── Add Docker's official GPG key ─────────────────────────────────
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# ── Add Docker repository ─────────────────────────────────────────
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# ── Install Docker Engine + Compose plugin ─────────────────────────
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# ── Allow your user to run Docker without sudo ─────────────────────
sudo usermod -aG docker $USER

# ── IMPORTANT: Log out and back in for group change to take effect ─
exit
```

**Now SSH back in**, then verify Docker is working:

```bash
ssh -i ~/your-key.pem ubuntu@YOUR_SERVER_IP
docker --version        # Should print Docker version 24+
docker compose version  # Should print Docker Compose v2+
```

---

### 4. Clone the Repository

```bash
# Clone your repo (replace with your actual repo URL)
git clone https://github.com/mozzdevv/MS_TraderScanner.git
cd MS_TraderScanner 
```

---

### 5. Configure for Your Server IP

The frontend needs to know where to reach the backend API. By default it connects to `localhost`, which works if you're accessing the dashboard from the same machine. **If you're accessing from your phone or another computer**, you need to set your server's IP.

Edit `docker-compose.yml` and update the build args:

```bash
nano docker-compose.yml
```

Change these lines under the `frontend` service:

```yaml
    build:
      context: ./frontend
      args:
        - NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:8000
        - NEXT_PUBLIC_WS_URL=ws://YOUR_SERVER_IP:8000/ws
```

Replace `YOUR_SERVER_IP` with your VPS public IP address (e.g. `http://129.213.45.123:8000`).

Save and exit (`Ctrl+X`, then `Y`, then `Enter`).

---

### 6. Build & Launch

```bash
# Build both containers and start them
docker compose up --build -d
```

The first build will take 2-5 minutes (downloading base images, installing dependencies, building Next.js). Subsequent builds are much faster due to caching.

Watch the build progress:

```bash
docker compose logs -f
```

Press `Ctrl+C` to stop watching logs (containers keep running).

---

### 7. Verify Everything Is Running

```bash
# Check container status — both should show "Up" and "(healthy)"
docker compose ps
```

Expected output:

```
NAME               STATUS                   PORTS
scanner-backend    Up 2 minutes (healthy)   0.0.0.0:8000->8000/tcp
scanner-frontend   Up 1 minute              0.0.0.0:3000->3000/tcp
```

Test the API:

```bash
# Should return settings JSON
curl http://localhost:8000/api/settings

# Should return engine status
curl http://localhost:8000/api/status
```

Open the dashboard in your browser:

```
http://YOUR_SERVER_IP:3000
```

---

### 8. Run 24/7 in the Background

Docker Compose with `-d` flag already runs in the background. The `restart: unless-stopped` policy in docker-compose.yml means containers will **automatically restart** if they crash or if the server reboots.

To make Docker start on boot (usually enabled by default):

```bash
sudo systemctl enable docker
```

That's it — your scanner is now running 24/7.

---

### 9. View Logs

```bash
# All logs
docker compose logs

# Follow logs in real-time
docker compose logs -f

# Backend only
docker compose logs -f backend

# Frontend only
docker compose logs -f frontend

# Last 100 lines
docker compose logs --tail=100 backend
```

---

### 10. Update the App

When you push code changes to your repo:

```bash
cd ~/TradingScanner

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up --build -d

# Verify
docker compose ps
```

Your SQLite database is stored in a **Docker volume** (`scanner-data`), so your watchlist, settings, and alert history are preserved across rebuilds.

---

### 11. Firewall Configuration

#### Oracle Cloud (OCI)

OCI requires you to open ports in **both** the security list and the OS firewall:

```bash
# Open ports in iptables (OS-level)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT
sudo netfilter-persistent save
```

Also in the OCI Console:
1. Go to **Networking → Virtual Cloud Networks → Your VCN → Security Lists**
2. Add **Ingress Rules** for TCP ports `3000` and `8000` from source `0.0.0.0/0`

#### Google Cloud (GCE)

```bash
# Create firewall rules
gcloud compute firewall-rules create allow-scanner \
    --allow tcp:3000,tcp:8000 \
    --source-ranges 0.0.0.0/0 \
    --description "Stock Momentum Scanner"
```

#### AWS (EC2)

In the AWS Console:
1. Go to **EC2 → Security Groups → Your Instance's SG**
2. Add **Inbound Rules**: Custom TCP, ports `3000` and `8000`, source `0.0.0.0/0`

#### Ubuntu UFW (if enabled)

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
sudo ufw reload
```

---

## Configuration

All settings are configurable from the dashboard UI at `http://YOUR_SERVER_IP:3000`:

| Setting | Default | Description |
|---------|---------|-------------|
| Jump Threshold | 10% | Minimum % jump from window low to trigger alert |
| Time Window | 60 sec | Rolling window duration for price tracking |
| Poll Interval | 7 sec | How often to fetch prices from Yahoo Finance |
| Discord Webhook | (empty) | Your Discord webhook URL for push notifications |

### Setting Up Discord Webhook

1. Open Discord → go to your server → channel settings
2. **Integrations → Webhooks → New Webhook**
3. Name it anything (e.g. "Scanner Alerts")
4. Copy the webhook URL
5. Paste it into the **Discord Webhook** field on the dashboard
6. Click **Save Settings**

---

## How It Works

1. You add stock tickers to the **Watchlist** (manually screened: under $10, < $75M float, > $5M volume)
2. The **Polling Engine** fetches live prices every 7 seconds via yfinance
3. It maintains a **rolling 60-second window** of price data per ticker
4. If a stock's current price is ≥ 10% above the window's lowest price → **ALERT**
5. Alert is:
   - Saved to the database
   - Shown on the dashboard in real-time via WebSocket
   - Sent to Discord via webhook (instant phone notification)
6. The rolling window for that ticker is **cleared** to prevent duplicate alerts

---

## Troubleshooting

### Containers won't start

```bash
# Check detailed logs
docker compose logs backend
docker compose logs frontend
```

### Can't access dashboard from browser

- Check firewall rules (see [Firewall Configuration](#11-firewall-configuration))
- Verify containers are running: `docker compose ps`
- Make sure you replaced `YOUR_SERVER_IP` in docker-compose.yml

### Backend shows "no price data"

- yfinance may be rate-limited. Increase poll interval to 10-15 seconds
- Some very small tickers may not have real-time data on Yahoo Finance

### Database reset

```bash
# Stop containers
docker compose down

# Remove the data volume (deletes watchlist, settings, alert history)
docker volume rm tradingscanner_scanner-data

# Restart fresh
docker compose up --build -d
```

### Full reset (nuclear option)

```bash
docker compose down --volumes --rmi all
docker compose up --build -d
```
