import httpx, json, sys
sys.stdout.reconfigure(encoding='utf-8')

r = httpx.post(
    "http://localhost:4021/analyze-contract",
    json={"contract_text": "The client shall indemnify and hold harmless the provider."},
    timeout=10,
)
print(f"HTTP Status: {r.status_code}")
print(f"\nResponse Headers:")
for k, v in r.headers.items():
    print(f"  {k}: {v[:200]}")

print(f"\nRaw body ({len(r.content)} bytes):")
print(r.text[:2000])

# Try to parse
try:
    d = r.json()
    print("\nParsed JSON:")
    print(json.dumps(d, indent=2)[:2000])
except:
    print("Could not parse as JSON")
