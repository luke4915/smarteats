#!/bin/bash
# Prova l'app da iPhone/iPad sulla rete di casa, con il Mac che fa da server.
# Il problema: ogni locale è un sottodominio (sagra.smarteats.local) e il telefono non sa risolvere i nomi `.local` del Mac. Soluzione: un nome
# che punta da solo all'IP del Mac, `<ip-con-trattini>.sslip.io` (servizio pubblico gratuito: 192-168-1-20.sslip.io → 192.168.1.20), usato
# come dominio dell'app: il locale è il primo pezzo (sagra.192-168-1-20.sslip.io). Qui si prepara il certificato HTTPS e si stampa cosa lanciare.
# Uso: ./scripts/iphone.sh   (poi seguire le istruzioni stampate). Serve mkcert e il Mac con il telefono sulla stessa rete Wi-Fi.
set -e
cd "$(dirname "$0")/.."

IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)}"
if [ -z "$IP" ]; then echo "Non trovo l'indirizzo del Mac sulla rete: passalo a mano (./scripts/iphone.sh 192.168.1.20)"; exit 1; fi
DOMAIN="${IP//./-}.sslip.io"
KEY="$PWD/backend/iphone-key.pem"
CERT="$PWD/backend/iphone.pem"

mkcert -cert-file "$CERT" -key-file "$KEY" "$DOMAIN" "*.$DOMAIN" >/dev/null 2>&1
CA="$(mkcert -CAROOT)/rootCA.pem"

cat <<TXT

Indirizzo del Mac: $IP      Dominio per il telefono: $DOMAIN

1) Fidati del certificato sul telefono (una sola volta)
   - Invia con AirDrop il file:  $CA
   - Sul telefono: Impostazioni → «Profilo scaricato» → Installa.
   - Poi: Impostazioni → Generali → Info → Attendibilità certificati → attiva «mkcert …».

2) In due terminali sul Mac
   cd backend  && APP_DOMAIN=$DOMAIN HTTPS_KEY_PATH=$KEY HTTPS_CERT_PATH=$CERT npm run dev
   cd frontend && VITE_DEV_DOMAIN=$DOMAIN npm run dev

3) Sul telefono (stessa rete Wi-Fi) apri
   https://sagra.$DOMAIN:5173         (al posto di «sagra» il nome del locale)
   Il menu dei clienti:  https://sagra.$DOMAIN:5173/menu

Se non si apre:
   - Il Mac chiede di accettare le connessioni in entrata per «node»: consenti (Impostazioni → Rete → Firewall).
   - Alcuni router bloccano i nomi che puntano a indirizzi di casa: sul telefono imposta il DNS del Wi-Fi su 1.1.1.1 o 8.8.8.8.
   - Se cambia la rete (e l'indirizzo del Mac) rilancia questo script.
TXT
