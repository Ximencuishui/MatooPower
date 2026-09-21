# Matoo Power · Pre-deploy i18n gate (PowerShell entry point)
#
# Runs the full pre-deploy i18n pipeline:
#   1. prune-mojibake.js          (clean JSON files)
#   2. prune-mojibake-html.js     (clean HTML inline blocks)
#   3. backfill-missing-i18n-keys.js  (fill missing with en fallback)
#   4. _audit_i18n_deploy.js      (verify all 12 pages x 14 languages)
#
# Returns:
#   exit 0 on success
#   exit 1 on any failed step
#
# Idempotent — running twice should yield zero changes.

[CmdletBinding()]
param(
    [switch]$SkipPrune,
    [switch]$SkipBackfill,
    [switch]$SkipAudit
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

try {
    $failed = 0

    if (-not $SkipPrune) {
        Write-Host ""
        Write-Host "=== 1/4 prune JSON files ==="
        & node prune-mojibake.js
        if ($LASTEXITCODE -ne 0) { $failed++; Write-Host "  [FAIL] prune JSON files" -ForegroundColor Red }
        else { Write-Host "  [OK]   prune JSON files" -ForegroundColor Green }

        Write-Host ""
        Write-Host "=== 2/4 prune HTML blocks ==="
        & node prune-mojibake-html.js
        if ($LASTEXITCODE -ne 0) { $failed++; Write-Host "  [FAIL] prune HTML blocks" -ForegroundColor Red }
        else { Write-Host "  [OK]   prune HTML blocks" -ForegroundColor Green }
    }

    if (-not $SkipBackfill) {
        Write-Host ""
        Write-Host "=== 3/4 backfill missing keys ==="
        & node backfill-missing-i18n-keys.js
        if ($LASTEXITCODE -ne 0) { $failed++; Write-Host "  [FAIL] backfill" -ForegroundColor Red }
        else { Write-Host "  [OK]   backfill" -ForegroundColor Green }
    }

    if (-not $SkipAudit) {
        Write-Host ""
        Write-Host "=== 4/4 audit ==="
        & node _audit_i18n_deploy.js
        if ($LASTEXITCODE -ne 0) { $failed++; Write-Host "  [FAIL] audit" -ForegroundColor Red }
        else { Write-Host "  [OK]   audit" -ForegroundColor Green }
    }

    Write-Host ""
    Write-Host "=== Gate summary ==="
    if ($failed -gt 0) {
        Write-Host "FAILED: $failed step(s) returned non-zero." -ForegroundColor Red
        exit 1
    } else {
        Write-Host "PASSED: all steps succeeded." -ForegroundColor Green
        exit 0
    }
} finally {
    Pop-Location
}