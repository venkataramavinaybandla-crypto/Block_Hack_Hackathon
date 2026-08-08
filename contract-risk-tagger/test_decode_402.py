import httpx, json, base64, sys
sys.stdout.reconfigure(encoding='utf-8')

r = httpx.post(
    "http://localhost:4021/analyze-contract",
    json={"contract_text": "The client shall indemnify the provider from all claims."},
    timeout=10,
)
print(f"HTTP Status: {r.status_code}")

# Decode the payment-required header (base64 JSON)
pr_header = r.headers.get("payment-required", "")
if pr_header:
    # Base64 padding fix
    padding = 4 - len(pr_header) % 4
    if padding != 4:
        pr_header += "=" * padding
    decoded = base64.b64decode(pr_header).decode("utf-8")
    payment_data = json.loads(decoded)
    print("\nDECODED payment-required header:")
    print(json.dumps(payment_data, indent=2))
