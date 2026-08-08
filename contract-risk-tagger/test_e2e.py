import httpx, json, sys

# Windows consoles default to cp1252 — force UTF-8 so emoji/arrows print (and never crash).
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding='utf-8')
    except Exception:
        pass

print("=" * 60)
print("CONTRACT RISK TAGGER — END-TO-END TEST")
print("=" * 60)

# 1. Python backend health
try:
    r = httpx.get("http://localhost:8000/health", timeout=5)
    print(f"\n[1] Python AI Backend health: {r.status_code}")
    print(f"    {r.json()}")
except Exception as e:
    print(f"\n[1] Python backend ERROR: {e}")

# 2. x402 server health
try:
    r = httpx.get("http://localhost:4021/health", timeout=5)
    print(f"\n[2] x402 Server health: {r.status_code}")
    d = r.json()
    print(f"    status: {d.get('status')}")
    print(f"    receiver: {d.get('receiver_address','')[:20]}...")
    print(f"    ai_backend: {d.get('ai_backend')}")
except Exception as e:
    print(f"\n[2] x402 server ERROR: {e}")

# 3. x402 gate — expect 402
try:
    r = httpx.post(
        "http://localhost:4021/analyze-contract",
        json={"contract_text": "The client shall indemnify and hold harmless the provider from all claims."},
        timeout=10,
    )
    print(f"\n[3] POST /analyze-contract (no payment): HTTP {r.status_code}")
    if r.status_code == 402:
        print("    ✅ 402 PAYMENT REQUIRED — CONFIRMED!")
        data = r.json()
        accepts = data.get("accepts", [{}])
        if accepts:
            a = accepts[0]
            print(f"    Price  : {a.get('price')}")
            print(f"    PayTo  : {a.get('payTo','')[:30]}...")
            print(f"    Network: {a.get('network','')[:40]}")
        print(f"\n    Full 402 response:")
        print(json.dumps(data, indent=4)[:800])
    else:
        print(f"    Unexpected status. Body: {r.text[:300]}")
except Exception as e:
    print(f"\n[3] Gate test ERROR: {e}")

# 4. Sample contract
try:
    r = httpx.get("http://localhost:8000/sample-contract", timeout=5)
    sample = r.json().get("contract_text","")
    print(f"\n[4] Sample contract: {len(sample)} chars loaded OK")
except Exception as e:
    print(f"\n[4] Sample contract ERROR: {e}")

print("\n" + "=" * 60)
print("DEMO READY:")
print("  Frontend : http://localhost:8000")
print("  x402 gate: http://localhost:4021/analyze-contract")
print("  Fund wallet: https://lora.algokit.io/testnet/fund")
print("=" * 60)
