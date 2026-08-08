import httpx, json, sys, base64
sys.stdout.reconfigure(encoding='utf-8')

print("=" * 60)
print("SERVER STATUS CHECK")
print("=" * 60)

# 1. Python backend
try:
    r = httpx.get("http://localhost:8000/health", timeout=5)
    print(f"\n[Python backend :8000] {r.status_code} — {r.json()}")
except Exception as e:
    print(f"\n[Python backend :8000] OFFLINE — {e}")

# 2. x402 server
try:
    r = httpx.get("http://localhost:4021/health", timeout=5)
    d = r.json()
    print(f"[x402 server    :4021] {r.status_code} — status:{d.get('status')} ai_backend:{d.get('ai_backend',{}).get('status')}")
except Exception as e:
    print(f"[x402 server    :4021] OFFLINE — {e}")

print("\n" + "=" * 60)
print("WALLET STATUS — Algorand Testnet")
print("=" * 60)

WALLET = "2TXWLUCA3XVUNDNEFSI6GNSFDD7KXZMQDAWJOYKTZMBMXNZWTXYT73AGCU"
USDC_ASA = 10458941

try:
    r = httpx.get(
        f"https://testnet-idx.algonode.cloud/v2/accounts/{WALLET}",
        timeout=10
    )
    if r.status_code == 200:
        data = r.json()
        acct = data.get("account", {})
        algo_balance = acct.get("amount", 0) / 1_000_000
        print(f"\nWallet : {WALLET}")
        print(f"ALGO   : {algo_balance:.6f} ALGO")
        
        assets = acct.get("assets", [])
        usdc_found = False
        for asset in assets:
            if asset.get("asset-id") == USDC_ASA:
                usdc_amt = asset.get("amount", 0) / 1_000_000
                print(f"USDC   : {usdc_amt:.6f} USDC (ASA {USDC_ASA}) ✅ OPTED IN")
                usdc_found = True
        if not usdc_found:
            print(f"USDC   : NOT OPTED IN (ASA {USDC_ASA}) ❌")
        
        if algo_balance == 0:
            print("\n⚠️  Wallet has 0 ALGO — needs funding!")
            print("   Fund at: https://lora.algokit.io/testnet/fund")
        else:
            print(f"\n✅ Wallet has {algo_balance:.3f} ALGO")
    else:
        print(f"Indexer returned {r.status_code}")
        print(r.text[:300])
except Exception as e:
    print(f"Error checking wallet: {e}")

print("\n" + "=" * 60)
print("402 GATE TEST")
print("=" * 60)
try:
    r = httpx.post(
        "http://localhost:4021/analyze-contract",
        json={"contract_text": "The client shall indemnify the provider from all claims regardless of fault."},
        timeout=10
    )
    print(f"\nStatus: {r.status_code}")
    if r.status_code == 402:
        print("✅ 402 CONFIRMED")
        pr = r.headers.get("payment-required", "")
        if pr:
            padded = pr + "=" * (4 - len(pr) % 4)
            d = json.loads(base64.b64decode(padded).decode())
            a = d.get("accepts", [{}])[0]
            print(f"   Amount  : {a.get('amount')} microUSDC = ${int(a.get('amount',0))/1e6:.2f} USDC")
            print(f"   Asset   : {a.get('asset')} (USDC)")
            print(f"   PayTo   : {a.get('payTo','')[:50]}")
    else:
        print(f"UNEXPECTED: {r.text[:200]}")
except Exception as e:
    print(f"Error: {e}")
