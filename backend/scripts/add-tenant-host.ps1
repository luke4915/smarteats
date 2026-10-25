# add-tenant-host.ps1 <slug>
# Da lanciare come Amministratore, DOPO aver fatto setup-wildcard-dev.ps1 una volta.
# Unico step ripetuto per ogni nuovo tenant di TEST sul tuo PC di sviluppo.
param([Parameter(Mandatory=$true)][string]$Slug)

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$entry = "127.0.0.1 $Slug.smarteats.local"

if (Select-String -Path $hostsPath -Pattern "$Slug\.smarteats\.local" -Quiet) {
    Write-Host "Già presente: $entry"
} else {
    Add-Content -Path $hostsPath -Value $entry
    Write-Host "Aggiunto: $entry"
}

Write-Host "`nOra puoi aprire: https://$Slug.smarteats.local:5173"
Write-Host "(nessun certificato o vite.config da toccare, grazie al wildcard)"
