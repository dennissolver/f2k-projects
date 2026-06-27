# Supabase migration push script - non-interactive
# Usage: ./scripts/supabase-push-migration.ps1
# Requires: SUPABASE_DB_URL env var or uses default from .env.local

$ErrorActionPreference = "Stop"

$ProjectRef = "zzajvnhsesqrrepflrrx"
$DbUrl = $env:SUPABASE_DB_URL

if (-not $DbUrl) {
    # Try to extract from .env.local
    $envFile = ".env.local"
    if (Test-Path $envFile) {
        $content = Get-Content $envFile -Raw
        if ($content -match "POSTGRES_URL=""([^""]+)""") {
            $DbUrl = $matches[1]
        }
        elseif ($content -match "POSTGRES_URL=([^`r`n]+)") {
            $DbUrl = $matches[1].Trim()
        }
    }
}

if (-not $DbUrl) {
    Write-Error "SUPABASE_DB_URL not set and could not be extracted from .env.local"
    exit 1
}

Write-Host "Pushing migrations to Supabase project: $ProjectRef"

# Use --yes to auto-confirm and --db-url for the connection
npx supabase db push --db-url $DbUrl --yes
