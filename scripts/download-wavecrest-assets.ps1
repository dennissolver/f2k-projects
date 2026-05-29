# Wavecrest Estate - Asset Download Script
# Run from project root: powershell -File scripts/download-wavecrest-assets.ps1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
$PSDefaultParameterValues['Invoke-WebRequest:UserAgent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
$ErrorActionPreference = "Stop"
$targetDir = "public\wavecrest"

# Ensure target directory exists
if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$assets = @(
    @{
        name = "Lot Numbers & Layout (master plan)"
        url = "https://hld.com.au/wp-content/uploads/2025/06/Lot-Numbers-and-Layout_page-0001-Updated.png"
        filename = "lot-numbers-layout.png"
    },
    @{
        name = "Stage 2 approval plan"
        url = "https://hld.com.au/wp-content/uploads/2025/12/Stage-2-68-Lot_Approval-10-scaled.png"
        filename = "stage-2-approval.png"
    },
    @{
        name = "Agonis Lane"
        url = "https://hld.com.au/wp-content/uploads/2026/02/AGONIS-LANE-scaled.png"
        filename = "agonis-lane.png"
    },
    @{
        name = "Panorama"
        url = "https://hld.com.au/wp-content/uploads/2018/11/IMG_20140511_143703-PANO1.jpg"
        filename = "panorama.jpg"
    },
    @{
        name = "Moresby aerial (marked boundaries)"
        url = "https://hld.com.au/wp-content/uploads/2018/11/IMG_7442PP-Moresby-aerial-with-marked-boundaries-and-title-1.jpg"
        filename = "moresby-aerial-marked.jpg"
    },
    @{
        name = "Aerial"
        url = "https://hld.com.au/wp-content/uploads/2019/04/8-e1554365719201.jpg"
        filename = "aerial.jpg"
    }
)

Write-Host "Downloading Wavecrest assets to $targetDir..." -ForegroundColor Cyan
Write-Host ""

foreach ($asset in $assets) {
    $outFile = Join-Path $targetDir $asset.filename
    Write-Host "Downloading: $($asset.name)..." -NoNewline
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $asset.url -OutFile $outFile -UseBasicParsing -TimeoutSec 60
        $size = (Get-Item $outFile).Length / 1KB
        Write-Host " Done ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
    } catch {
        Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Downloading flyover video from YouTube..." -ForegroundColor Cyan

# Check if yt-dlp is available
$ytDlp = Get-Command yt-dlp -ErrorAction SilentlyContinue
if ($ytDlp) {
    $videoOut = Join-Path $targetDir "flyover.mp4"
    Write-Host "Using yt-dlp to download video..." -NoNewline
    try {
        yt-dlp -f "best[ext=mp4]" -o $videoOut "https://www.youtube.com/watch?v=RrjdYPyms40" --no-playlist
        $size = (Get-Item $videoOut).Length / 1MB
        Write-Host " Done ($([math]::Round($size, 1)) MB)" -ForegroundColor Green
    } catch {
        Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "yt-dlp not found. To download the video:" -ForegroundColor Yellow
    Write-Host "  1. Install: winget install yt-dlp.week" -ForegroundColor Yellow
    Write-Host "  2. Run: yt-dlp -f 'best[ext=mp4]' -o 'public\wavecrest\flyover.mp4' https://www.youtube.com/watch?v=RrjdYPyms40" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Download complete! Files saved to: $targetDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files downloaded:" -ForegroundColor White
Get-ChildItem $targetDir | ForEach-Object { Write-Host "  - $($_.Name) ($([math]::Round($_.Length/1KB, 1)) KB)" }
