# ChatBot verification script - install, build, and health checks
# Run from repo root: .\scripts\verify.ps1

$ErrorActionPreference = "Stop"
$failed = @()
$passed = @()

function Assert-Check {
    param([string]$Name, [scriptblock]$Block)
    try {
        & $Block
        $script:passed += $Name
        Write-Host "[PASS] $Name" -ForegroundColor Green
        return $true
    } catch {
        $script:failed += $Name
        Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "`n=== ChatBot Verification ===" -ForegroundColor Cyan

# 1. Bun install
Assert-Check "bun install" {
    $root = Join-Path $PSScriptRoot ".."
    Set-Location $root
    bun install
    if ($LASTEXITCODE -ne 0) { throw "bun install exited $LASTEXITCODE" }
} | Out-Null

# 2. Server TypeScript build (tsc --noEmit)
Assert-Check "apps/server build (tsc)" {
    $root = Join-Path $PSScriptRoot ".."
    Set-Location (Join-Path $root "apps/server")
    bun run build
    if ($LASTEXITCODE -ne 0) { throw "server build exited $LASTEXITCODE" }
} | Out-Null

# 3. Client build
Assert-Check "apps/client build" {
    $root = Join-Path $PSScriptRoot ".."
    Set-Location (Join-Path $root "apps/client")
    bun run build
    if ($LASTEXITCODE -ne 0) { throw "client build exited $LASTEXITCODE" }
} | Out-Null

# 4. Python venv exists
Assert-Check "Python venv exists" {
    $venv = Join-Path (Join-Path $PSScriptRoot "..") "services/python/.venv"
    if (-not (Test-Path $venv)) { throw "services/python/.venv not found" }
} | Out-Null

# 5. Python deps import (quick check)
Assert-Check "Python deps (chromadb, sentence-transformers)" {
    $pyExe = Join-Path (Join-Path $PSScriptRoot "..") "services/python/.venv/Scripts/python.exe"
    if (-not (Test-Path $pyExe)) { throw "venv python not found" }
    & $pyExe -c "import chromadb; import sentence_transformers; print('ok')"
    if ($LASTEXITCODE -ne 0) { throw "Python import failed" }
} | Out-Null

# 6. data/products exists with .txt files
Assert-Check "data/products (3+ .txt files)" {
    $productsDir = Join-Path (Join-Path $PSScriptRoot "..") "data/products"
    $products = Get-ChildItem (Join-Path $productsDir "*.txt") -ErrorAction SilentlyContinue
    if ($products.Count -lt 3) { throw "Expected 3+ .txt files, found $($products.Count)" }
} | Out-Null

# 7. Index KB (--rebuild) - validates indexer works
Assert-Check "Python KB index (index_kb.py --rebuild)" {
    $pyDir = Join-Path (Join-Path $PSScriptRoot "..") "services/python"
    $pyExe = Join-Path $pyDir ".venv/Scripts/python.exe"
    Push-Location $pyDir
    try {
        & $pyExe index_kb.py --rebuild
        if ($LASTEXITCODE -ne 0) { throw "index_kb.py exited $LASTEXITCODE" }
    } finally { Pop-Location }
} | Out-Null

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $($passed.Count) - $($passed -join ', ')" -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Host "Failed: $($failed.Count) - $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "All checks passed." -ForegroundColor Green
exit 0
