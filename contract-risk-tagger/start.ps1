# CERBERUS — Production Startup Script
# Starts both services with environment validation and readiness checks.

param(
  [switch]$Demo  # Pass -Demo to enable demo mode (sets DEMO_MODE=true in x402-server/.env)
)

Write-Host "`n" + ("=" * 62) -ForegroundColor Cyan
Write-Host "  CERBERUS — x402 AI Legal Contract Risk Analyzer" -ForegroundColor Cyan
Write-Host ("=" * 62) -ForegroundColor Cyan

# ── Environment Validation ────────────────────────────────────────────
Write-Host "`n[env] Validating configuration..." -ForegroundColor Yellow

$x402Env   = "c:\Hackathon\contract-risk-tagger\x402-server\.env"
$backendEnv = "c:\Hackathon\contract-risk-tagger\backend\.env"

if (-not (Test-Path $x402Env)) {
  Write-Host "[error] Missing x402-server/.env — copy .env.example and fill it in." -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $backendEnv)) {
  Write-Host "[error] Missing backend/.env — copy .env.example and fill it in." -ForegroundColor Red
  exit 1
}

# Check INTERNAL_SECRET is set in both files
$x402Secret   = (Get-Content $x402Env   | Select-String "^INTERNAL_SECRET=(.+)$").Matches.Groups[1].Value
$backendSecret = (Get-Content $backendEnv | Select-String "^INTERNAL_SECRET=(.+)$").Matches.Groups[1].Value

if (-not $x402Secret) {
  Write-Host "[error] INTERNAL_SECRET is not set in x402-server/.env. Refusing to start." -ForegroundColor Red
  exit 1
}
if (-not $backendSecret) {
  Write-Host "[error] INTERNAL_SECRET is not set in backend/.env. Refusing to start." -ForegroundColor Red
  exit 1
}
if ($x402Secret -ne $backendSecret) {
  Write-Host "[error] INTERNAL_SECRET mismatch between x402-server/.env and backend/.env." -ForegroundColor Red
  exit 1
}

Write-Host "  [ok] INTERNAL_SECRET set and matching in both .env files" -ForegroundColor Green

# ── Demo Mode Flag ────────────────────────────────────────────────────
if ($Demo) {
  Write-Host "`n  [demo] -Demo flag detected: enabling DEMO_MODE=true in x402-server/.env" -ForegroundColor Yellow
  Write-Host "         WARNING: Demo mode bypasses real payment verification." -ForegroundColor Yellow
  (Get-Content $x402Env) -replace "^DEMO_MODE=.*", "DEMO_MODE=true" | Set-Content $x402Env
} else {
  # Ensure DEMO_MODE is off for production
  (Get-Content $x402Env) -replace "^DEMO_MODE=.*", "DEMO_MODE=false" | Set-Content $x402Env
  Write-Host "  [ok] DEMO_MODE=false (production mode)" -ForegroundColor Green
}

# ── Start Python AI Backend ───────────────────────────────────────────
Write-Host "`n[1/2] Starting Python AI backend (port 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "Write-Host 'CERBERUS — Python AI Backend' -ForegroundColor Cyan; " + `
  "cd 'c:\Hackathon\contract-risk-tagger\backend'; " + `
  "python -m uvicorn main:app --host 127.0.0.1 --port 8000 --log-level info" `
  -WindowStyle Normal

# Wait for backend to be ready
Write-Host "  Waiting for backend to be ready..." -ForegroundColor Yellow
$backendReady = $false
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) { $backendReady = $true; break }
  } catch {}
  Write-Host "  ." -NoNewline -ForegroundColor Gray
}

if ($backendReady) {
  Write-Host "`n  [ok] Python AI backend is ready" -ForegroundColor Green
} else {
  Write-Host "`n  [warn] Backend health check timed out — it may still be starting up" -ForegroundColor Yellow
}

# ── Start Node x402 Server ────────────────────────────────────────────
Write-Host "`n[2/2] Starting x402 Node gateway (port 4021)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "Write-Host 'CERBERUS — x402 Gateway' -ForegroundColor Cyan; " + `
  "cd 'c:\Hackathon\contract-risk-tagger\x402-server'; npm run dev" `
  -WindowStyle Normal

# Wait for gateway to be ready
Write-Host "  Waiting for gateway to be ready..." -ForegroundColor Yellow
$gatewayReady = $false
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:4021/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) { $gatewayReady = $true; break }
  } catch {}
  Write-Host "  ." -NoNewline -ForegroundColor Gray
}

if ($gatewayReady) {
  Write-Host "`n  [ok] x402 Gateway is ready" -ForegroundColor Green
} else {
  Write-Host "`n  [warn] Gateway health check timed out — it may still be starting up" -ForegroundColor Yellow
}

# ── Startup Summary ────────────────────────────────────────────────────
Write-Host "`n" + ("=" * 62) -ForegroundColor Cyan
Write-Host "  CERBERUS is RUNNING" -ForegroundColor Green
Write-Host ("=" * 62) -ForegroundColor Cyan
Write-Host "  Frontend   : http://localhost:8000" -ForegroundColor White
Write-Host "  AI Backend : http://localhost:8000/health" -ForegroundColor White
Write-Host "  x402 Gateway: http://localhost:4021/health" -ForegroundColor White
Write-Host ""

$walletAddr = (Get-Content $x402Env | Select-String "^AVM_ADDRESS=(.+)$").Matches.Groups[1].Value
if ($walletAddr) {
  Write-Host "  Wallet     : $walletAddr" -ForegroundColor Cyan
  Write-Host "  Explorer   : https://testnet.explorer.perawallet.app/address/$walletAddr" -ForegroundColor Cyan
}

Write-Host "`n  Payment Flow:" -ForegroundColor Yellow
Write-Host "    1. Open http://localhost:8000 in your browser"
Write-Host "    2. Paste or upload a contract document"
Write-Host "    3. Click 'Analyze Contract' -> HTTP 402 is returned"
Write-Host "    4. Fund your wallet at https://lora.algokit.io/testnet/fund"
Write-Host "    5. Send `$0.01 USDC (ASA 10458941) to the wallet address above"
Write-Host "    6. Paste your TxID and click 'Verify & Analyze'"

if ($Demo) {
  Write-Host "`n  [demo mode] DEMO_MODE is ON — start with .\start.ps1 (no flag) for production" -ForegroundColor Yellow
}
Write-Host ""
