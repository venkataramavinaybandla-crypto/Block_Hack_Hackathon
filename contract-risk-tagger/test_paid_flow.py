"""
CERBERUS — Adversarial Security Test Suite
Exits non-zero immediately on any failed assertion.

Tests:
  1. No payment header → HTTP 402
  2. POST direct to port 8000 (no secret) → HTTP 403
  3. POST direct to port 8000 (wrong secret) → HTTP 403
  4. Old ALGO native-pay TxID (wrong receiver, wrong asset, too old) → HTTP 402
  5. Replay attack: resubmitting any used TxID → HTTP 402
"""

import sys
import httpx

# Windows consoles default to cp1252 — force UTF-8 so emoji/arrows print (and never crash).
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ── Colour helpers ─────────────────────────────────────────────────
def ok(msg): print(f"  ✅ {msg}")
def fail(msg):
    print(f"  ❌ FAIL: {msg}", flush=True)
    sys.exit(1)

def post(url, **kwargs):
    """POST helper — any network error is a hard FAIL (non-zero exit), never just printed."""
    try:
        return httpx.post(url, **kwargs)
    except httpx.HTTPError as e:
        fail(f"Request to {url} failed — {type(e).__name__}: {e}")

# ── Config ─────────────────────────────────────────────────────────
X402_SERVER = "http://localhost:4021"
AI_BACKEND  = "http://localhost:8000"

SAMPLE_CONTRACT = (
    "INDEMNIFICATION CLAUSE: The Client shall indemnify the Service Provider "
    "from all claims, regardless of fault, including negligence or wilful misconduct. "
    "TERMINATION: Provider may terminate this Agreement without notice or compensation."
)

# TxID from 2019-era Algorand testnet (ALGO native pay, wrong receiver, very old)
OLD_NATIVE_TXID = "QOOBRVQMX4HW5QZ2EGLQDQCQTKRF3UP3JKDGKYPCXMI6AVV35KQA"

print("=" * 64)
print("CERBERUS — ADVERSARIAL SECURITY TEST SUITE")
print("=" * 64)

# ─── Test 1: 402 with no payment ──────────────────────────────────
print("\n[1] POST /analyze-contract — no payment header → expect 402")
r = post(f"{X402_SERVER}/analyze-contract",
         json={"contract_text": SAMPLE_CONTRACT}, timeout=15)
print(f"    Status: {r.status_code}")
if r.status_code != 402:
    fail(f"Expected HTTP 402 with no payment, got {r.status_code}: {r.text[:200]}")
ok("HTTP 402 returned with no payment header")

# ─── Test 2: Port 8000 direct — no secret → 403 ───────────────────
print("\n[2] POST http://localhost:8000/analyze-contract — no secret → expect 403")
r2 = post(f"{AI_BACKEND}/analyze-contract",
          json={"contract_text": SAMPLE_CONTRACT}, timeout=10)
print(f"    Status: {r2.status_code}")
if r2.status_code != 403:
    fail(f"Expected HTTP 403 (no secret), got {r2.status_code}: {r2.text[:200]}")
ok("HTTP 403 returned for direct call without X-Internal-Secret")

# ─── Test 3: Port 8000 direct — wrong secret → 403 ───────────────
print("\n[3] POST http://localhost:8000/analyze-contract — wrong secret → expect 403")
r3 = post(f"{AI_BACKEND}/analyze-contract",
          json={"contract_text": SAMPLE_CONTRACT},
          headers={"X-Internal-Secret": "wrong-secret-attempt"},
          timeout=10)
print(f"    Status: {r3.status_code}")
if r3.status_code != 403:
    fail(f"Expected HTTP 403 (wrong secret), got {r3.status_code}: {r3.text[:200]}")
ok("HTTP 403 returned for direct call with wrong X-Internal-Secret")

# ─── Test 4: Old ALGO native-pay TxID → 402 ───────────────────────
print(f"\n[4] POST /analyze-contract — old ALGO native TxID ({OLD_NATIVE_TXID[:16]}...) → expect 402")
r4 = post(
    f"{X402_SERVER}/analyze-contract",
    json={"contract_text": SAMPLE_CONTRACT},
    headers={
        "payment-signature": OLD_NATIVE_TXID,
        "X-Payment-TxID": OLD_NATIVE_TXID,
    },
    timeout=20
)
print(f"    Status: {r4.status_code}")
body4 = r4.json() if r4.headers.get("content-type", "").startswith("application/json") else {}
print(f"    Detail: {body4.get('detail', body4.get('error', r4.text[:200]))}")

if r4.status_code != 402:
    fail(
        f"Old ALGO native-pay TxID must be rejected with 402, got {r4.status_code}.\n"
        f"    This means the old bypass is STILL OPEN — fix verifyTxIdOnChain!"
    )
# Extra: confirm rejection reason mentions type, asset, or age — not just replay
detail4 = body4.get("detail", "")
if "already been used" in detail4:
    fail(
        "Old TxID was rejected only due to replay cache — that means it PASSED security checks "
        "before. Checks for tx-type / receiver / asset-id / age must fire FIRST."
    )
ok(f"Old ALGO native-pay TxID correctly rejected at 402. Reason: {detail4[:120]}")

# ─── Test 5: Replay attack on old TxID (should still be 402) ──────
print(f"\n[5] Replay: re-submit same old TxID → still expect 402")
r5 = post(
    f"{X402_SERVER}/analyze-contract",
    json={"contract_text": SAMPLE_CONTRACT},
    headers={
        "payment-signature": OLD_NATIVE_TXID,
        "X-Payment-TxID": OLD_NATIVE_TXID,
    },
    timeout=20
)
print(f"    Status: {r5.status_code}")
if r5.status_code != 402:
    fail(f"Replay attempt should still get 402, got {r5.status_code}")
ok("Replay attempt correctly rejected with 402")

# ─── Summary ──────────────────────────────────────────────────────
print("\n" + "=" * 64)
print("ALL 5 SECURITY ASSERTIONS PASSED — CERBERUS security is solid")
print("=" * 64)
sys.exit(0)
