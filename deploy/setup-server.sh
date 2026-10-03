#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu server (Oracle Cloud Always Free ARM VM) and first deployment.
# Run it on the server, as the default "ubuntu" user:
#
#   curl -fsSL https://raw.githubusercontent.com/DnyaneshSD1/ai-guruz/main/deploy/setup-server.sh -o setup-server.sh
#   bash setup-server.sh
#
# It asks for the Groq API key, installs Docker, opens ports 80/443 on the server's own firewall,
# clones the repository, writes deploy/.env and starts everything. Safe to run again.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/DnyaneshSD1/ai-guruz.git}"
APP_DIR="${APP_DIR:-$HOME/ai-guruz}"

echo "==> Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "==> Opening ports 80 and 443 on the server firewall"
# Oracle's Ubuntu images ship iptables rules that reject everything except SSH.
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
done
if command -v netfilter-persistent >/dev/null; then
  sudo netfilter-persistent save
fi

echo "==> Fetching the code"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR/deploy"

if [ ! -f .env ]; then
  echo "==> Creating deploy/.env"
  PUBLIC_IP="$(curl -fsS https://api.ipify.org)"
  DEFAULT_SITE="${PUBLIC_IP//./-}.sslip.io"
  read -r -p "Site address [$DEFAULT_SITE]: " SITE_ADDRESS
  SITE_ADDRESS="${SITE_ADDRESS:-$DEFAULT_SITE}"
  read -r -s -p "Groq API key (from https://console.groq.com/keys): " GROQ_KEY
  echo
  cp .env.example .env
  sed -i "s|^SITE_ADDRESS=.*|SITE_ADDRESS=$SITE_ADDRESS|" .env
  sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://${SITE_ADDRESS%%,*}|" .env
  sed -i "s|^INTERNAL_API_KEY=.*|INTERNAL_API_KEY=$(openssl rand -hex 32)|" .env
  sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$GROQ_KEY|" .env
  chmod 600 .env
fi

echo "==> Building and starting (the first build takes 15-30 minutes)"
sudo docker compose up -d --build

echo
echo "Done. The site will be at: https://$(grep '^SITE_ADDRESS=' .env | cut -d= -f2 | cut -d, -f1)"
echo "Check progress with:  cd $APP_DIR/deploy && sudo docker compose ps"
