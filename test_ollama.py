import httpx, json

payload = {
    "model": "qwen2.5:latest",
    "messages": [{"role": "user", "content": "Return ONLY valid JSON array: [{\"test\": true}]"}],
    "stream": False
}
r = httpx.post("http://localhost:11434/api/chat", json=payload, timeout=30)
print("Status:", r.status_code)
data = r.json()
print("Response:", data["message"]["content"][:300])
