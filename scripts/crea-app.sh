#!/bin/bash
# Crea l'app «SmartEats» per il Mac (un'icona da trascinare nel Dock). Si lancia una volta sola: ./scripts/crea-app.sh
# L'app avvia il server in silenzio (niente finestra del terminale), apre il browser sul locale `demo` e resta nel Dock
# finché non la chiudi (tasto destro sull'icona → Esci). I messaggi del server vanno in ~/Library/Logs/SmartEats.log.
# Se sposti la cartella del progetto o cambi la versione di Node, rilancia questo script.
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(dirname "$(command -v node)")"
APP="${1:-$HOME/Applications}/SmartEats.app"
[ -n "$NODE_BIN" ] || { echo "Node non trovato: installalo prima."; exit 1; }

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

# Icona: dal simbolo dell'app (frontend/public/pwa-512.png) in tutte le misure che il Mac chiede
ICONSET="$(mktemp -d)/SmartEats.iconset"; mkdir -p "$ICONSET"
for size in 16 32 64 128 256 512; do
  sips -z $size $size "$REPO/frontend/public/pwa-512.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$REPO/frontend/public/pwa-512.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/SmartEats.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>SmartEats</string>
  <key>CFBundleDisplayName</key><string>SmartEats</string>
  <key>CFBundleIdentifier</key><string>it.smarteats.launcher</string>
  <key>CFBundleExecutable</key><string>SmartEats</string>
  <key>CFBundleIconFile</key><string>SmartEats</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict></plist>
PLIST

# Il programma dell'app: avvia il server, apre il browser e resta vivo finché non si esce (Esci dal Dock ferma anche il server)
cat > "$APP/Contents/MacOS/SmartEats" <<LAUNCHER
#!/bin/bash
export PATH="$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:\$PATH"
REPO="$REPO"
LOG="\$HOME/Library/Logs/SmartEats.log"
cd "\$REPO"
PORT="\${PORT:-\$(grep -E '^PORT=' backend/.env 2>/dev/null | cut -d= -f2)}"; PORT="\${PORT:-3000}"
DOMAIN="\${APP_DOMAIN:-smarteats.local}"
URL="https://\${1:-demo}.\$DOMAIN:\$PORT"

# Già acceso (per esempio da un altro avvio)? Basta aprire il browser
if curl -ksf "https://127.0.0.1:\$PORT/api/health" >/dev/null 2>&1; then open "\$URL"; exit 0; fi

if [ ! -f frontend/dist/index.html ] || [ -n "\$(find frontend/src frontend/index.html frontend/package.json -newer frontend/dist/index.html -print -quit)" ]; then
  (cd frontend && npm run build >>"\$LOG" 2>&1)
fi
cd backend
NODE_ENV=production node server.js >>"\$LOG" 2>&1 &
SERVER=\$!
trap 'kill \$SERVER 2>/dev/null; exit 0' TERM INT HUP
for _ in \$(seq 1 60); do curl -ksf "https://127.0.0.1:\$PORT/api/health" >/dev/null 2>&1 && break; sleep 0.5; done
open "\$URL"
wait \$SERVER
LAUNCHER
chmod +x "$APP/Contents/MacOS/SmartEats"
echo "✔ Creata: $APP"
echo "  Trascina l'icona nel Dock; tasto destro → Esci per fermare il server."
