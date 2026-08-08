import httpx, json, sys, base64
sys.stdout.reconfigure(encoding='utf-8')

print("=" * 60)
print("TESTING PAYMENT-SIGNATURE PROCESSING IN X402-SERVER")
print("=" * 60)

# Test 1: Raw TxID string in payment-signature
raw_txid = "XYZ123TESTTXID9876543210"
r1 = httpx.post(
    "http://localhost:4021/analyze-contract",
    json={"contract_text": "The client shall indemnify provider from all liabilities."},
    headers={
        "Content-Type": "application/json",
        "payment-signature": raw_txid,
        "X-Payment-TxID": raw_txid
    },
    timeout=10
)
print(f"\n[Test 1: Raw TxID string] Status: {r1.status_code}")
print(f"Body: {r1.text[:300]}")
if "payment-required" in r1.headers:
    print(f"payment-required header present")

# Test 2: Formatted x402 payment payload base64
fake_x402_payload = {
    "version": "2",
    "scheme": "exact",
    "network": "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
    "payload": {
        "txId": raw_txid,
        "signedTxns": []
    }
}
b64_payload = base64.b64encode(json.dumps(fake_x402_payload).encode()).decode()

r2 = httpx.post(
    "http://localhost:4021/analyze-contract",
    json={"contract_text": "The client shall indemnify provider from all liabilities."},
    headers={
        "Content-Type": "application/json",
        "payment-signature": b64_payload,
        "X-Payment-TxID": raw_txid
    },
    timeout=10
)
print(f"\n[Test 2: Formatted base64 x402 payload] Status: {r2.status_code}")
print(f"Body: {r2.text[:300]}")

print("\nDone.")
