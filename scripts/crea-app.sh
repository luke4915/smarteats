#!/bin/bash
# Crea l'app «SmartEats» per il Mac (un'icona da trascinare nel Dock). Si lancia una volta sola: ./scripts/crea-app.sh
# L'app avvia il server in silenzio (niente finestra del terminale), apre il browser sul locale `demo` e resta nel Dock
# finché non la chiudi (tasto destro sull'icona → Esci, che ferma anche il server). Messaggi del server: ~/Library/Logs/SmartEats.log.
# Come è fatta (spiegata passo per passo in docs/guida-al-codice.md): un «applet» AppleScript (un vero programma Mac, per questo
# l'icona nel Dock smette di saltare) che chiama due script nella sua cartella Resources: start.sh e stop.sh.
# Se sposti la cartella del progetto o cambi la versione di Node, rilancia questo script.
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(dirname "$(command -v node)")"
APP="${1:-$HOME/Applications}/SmartEats.app"
[ -n "$NODE_BIN" ] || { echo "Node non trovato: installalo prima."; exit 1; }

# 1. L'involucro: un applet che resta aperto (-s) e chiama i due script
rm -rf "$APP"
SCRIPT="$(mktemp -d)/SmartEats.applescript"
cat > "$SCRIPT" <<'APPLESCRIPT'
on run
	set res to (path to me as text) & "Contents:Resources:"
	do shell script quoted form of POSIX path of (res & "start.sh") & " > /dev/null 2>&1"
end run

on idle
	return 30 -- l'app resta viva: così l'icona sta nel Dock finché non si sceglie Esci
end idle

on quit
	try
		set res to (path to me as text) & "Contents:Resources:"
		do shell script quoted form of POSIX path of (res & "stop.sh") & " > /dev/null 2>&1"
	end try
	continue quit
end quit
APPLESCRIPT
osacompile -s -o "$APP" "$SCRIPT"

# 2. L'icona: dal simbolo dell'app (frontend/public/pwa-512.png) in tutte le misure che il Mac chiede
ICONSET="$(mktemp -d)/SmartEats.iconset"; mkdir -p "$ICONSET"
for size in 16 32 64 128 256 512; do
  sips -z $size $size "$REPO/frontend/public/pwa-512.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$REPO/frontend/public/pwa-512.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/applet.icns"
# L'applet porta un'icona di serie dentro Assets.car, che avrebbe la precedenza: la togliamo, così vale la nostra
rm -f "$APP/Contents/Resources/Assets.car"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :CFBundleName SmartEats" "$APP/Contents/Info.plist" 2>/dev/null || true

# 3. start.sh: prepara il frontend se serve, avvia il server in coda, aspetta che risponda e apre il browser
cat > "$APP/Contents/Resources/start.sh" <<START
#!/bin/bash
export PATH="$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:\$PATH"
REPO="$REPO"
LOG="\$HOME/Library/Logs/SmartEats.log"
PIDFILE="\$HOME/Library/Caches/smarteats.pid"
cd "\$REPO"
PORT="\${PORT:-\$(grep -E '^PORT=' backend/.env 2>/dev/null | cut -d= -f2)}"; PORT="\${PORT:-3000}"
URL="https://\${1:-demo}.\${APP_DOMAIN:-smarteats.local}:\$PORT"
up() { curl -ksf "https://127.0.0.1:\$PORT/api/health" >/dev/null 2>&1; }

if ! up; then
  if [ ! -f frontend/dist/index.html ] || [ -n "\$(find frontend/src frontend/index.html frontend/package.json -newer frontend/dist/index.html -print -quit)" ]; then
    (cd frontend && npm run build >>"\$LOG" 2>&1)
  fi
  cd backend
  NODE_ENV=production nohup node server.js >>"\$LOG" 2>&1 &
  echo \$! > "\$PIDFILE"
  for _ in \$(seq 1 60); do up && break; sleep 0.5; done
fi
open "\$URL"
START

# 4. stop.sh: ferma il server avviato da start.sh
cat > "$APP/Contents/Resources/stop.sh" <<'STOP'
#!/bin/bash
PIDFILE="$HOME/Library/Caches/smarteats.pid"
[ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null
rm -f "$PIDFILE"
STOP
chmod +x "$APP/Contents/Resources/start.sh" "$APP/Contents/Resources/stop.sh"
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true      # firma locale, perché il Mac accetti di aprirla
touch "$APP"
echo "✔ Creata: $APP"
echo "  Trascina l'icona nel Dock; tasto destro → Esci per fermare il server."
