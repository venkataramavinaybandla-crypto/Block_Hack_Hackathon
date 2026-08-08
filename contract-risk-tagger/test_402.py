import httpx, json, sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

print("=" * 60)
print("402 RESPONSE BODY — FULL OUTPUT")
print("=" * 60)

r = httpx.post(
    "http://localhost:4021/analyze-contract",
    json={"contract_text": "The client shall indemnify and hold harmless the provider from all claims."},
    timeout=10,
)
print(f"HTTP Status: {r.status_code}")
print(f"\nResponse Body:")
print(json.dumps(r.json(), indent=2))
