import httpx, json

# Test with generate endpoint (faster), using mistral (lighter model)
payload = {
    "model": "mistral:latest",
    "prompt": 'Return ONLY a valid JSON array: [{"test": true}]',
    "stream": False,
    "options": {"temperature": 0.1, "num_predict": 100}
}
print("Testing mistral via /api/generate...")
try:
    r = httpx.post("http://localhost:11434/api/generate", json=payload, timeout=60)
    print("Status:", r.status_code)
    data = r.json()
    print("Response:", data.get("response", "")[:200])
except Exception as e:
    print("Error:", e)

# Also test OpenAI-compatible endpoint
print("\nTesting OpenAI-compatible endpoint...")
try:
    r2 = httpx.post(
        "http://localhost:11434/v1/chat/completions",
        json={
            "model": "mistral:latest",
            "messages": [{"role": "user", "content": "Say hello in 5 words."}],
            "max_tokens": 20
        },
        timeout=60
    )
    print("Status:", r2.status_code)
    print("Response:", r2.text[:200])
except Exception as e:
    print("Error:", e)
