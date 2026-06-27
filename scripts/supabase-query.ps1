# Supabase SQL query script
# Usage: ./scripts/supabase-query.ps1 "SELECT * FROM table LIMIT 10"

param(
    [Parameter(Mandatory=$true)]
    [string]$Sql
)

$ErrorActionPreference = "Stop"

# Intended live project. The CLI actually connects to whatever
# supabase/.temp/project-ref is linked to (or $env:SUPABASE_DB_URL), NOT this
# constant — so we print the REAL target and warn on drift. (A linked-to-demo
# CLI silently ran live-intended queries against the demo on 2026-06-06.)
$IntendedLiveRef = "zzajvnhsesqrrepflrrx"
$DbUrl = $env:SUPABASE_DB_URL

if ($DbUrl) {
    Write-Host "Running SQL via SUPABASE_DB_URL (explicit connection, not --linked)"
    npx supabase db query --db-url $DbUrl $Sql
} else {
    $LinkedRef = (Get-Content supabase/.temp/project-ref -ErrorAction SilentlyContinue)
    Write-Host "CLI is LINKED to project-ref: $LinkedRef  (intended live: $IntendedLiveRef)"
    if ($LinkedRef -and $LinkedRef -ne $IntendedLiveRef) {
        Write-Warning "LINKED REF != intended live ref. This query is NOT hitting live ($IntendedLiveRef). Re-link with: npx supabase link --project-ref $IntendedLiveRef"
    }
    npx supabase db query --linked $Sql
}
