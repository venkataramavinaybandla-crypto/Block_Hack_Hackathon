# Contract Clause Risk Tagger — Startup Script
# Run this to start both backend services

Write-Host "`n=== Contract Clause Risk Tagger ===" -ForegroundColor Cyan
Write-Host "Starting services...`n" -ForegroundColor Yellow

# Start Python AI backend
Write-Host "[1/2] Starting Python AI backend on port 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "cd 'c:\Hackathon\contract-risk-tagger\backend'; python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload" `
  -WindowStyle Normal

Start-Sleep -Seconds 3

# Start Node x402 server
Write-Host "[2/2] Starting x402 Node server on port 4021..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "cd 'c:\Hackathon\contract-risk-tagger\x402-server'; npm run dev" `
  -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "`n=== Services Started ===" -ForegroundColor Cyan
Write-Host "  AI Backend : http://localhost:8000" -ForegroundColor White
Write-Host "  x402 Server: http://localhost:4021" -ForegroundColor White
Write-Host "  Frontend   : http://localhost:8000  (served by AI backend)" -ForegroundColor White
Write-Host ""
Write-Host "DEMO FLOW:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:8000 in browser"
Write-Host "  2. Click 'Analyze Contract' -> should return 402"
Write-Host "  3. Fund wallet at https://lora.algokit.io/testnet/fund"
Write-Host "  4. Send USDC, paste TxID, click Submit"
Write-Host "  5. View results with risk analysis"
Write-Host ""
Write-Host "Wallet Address: 3LMI2BONQHGE6SCKLONQYJQCYIA5R32P5PEXLNXKUQS3CAMXRDDLBV342I" -ForegroundColor Cyan
