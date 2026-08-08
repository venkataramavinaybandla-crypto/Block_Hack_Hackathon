# 🚀 Deploying CERBERUS to Vercel

CERBERUS is configured for seamless deployment to **Vercel** as a unified serverless application.

---

## 📋 Environment Variables for Vercel

Set the following Environment Variables in your Vercel Project Settings (**Settings → Environment Variables**):

| Variable | Description | Example / Recommended Value |
|----------|-------------|-----------------------------|
| `AVM_ADDRESS` | Your Algorand Testnet receiver address for USDC micropayments | `2TXWLUCA3XVUNDNEFSI6GNSFDD7KXZMQDAWJOYKTZMBMXNZWTXYT73AGCU` |
| `GROQ_API_KEY` *(Recommended)* | Groq API Key for 1–2 sec clause risk analysis (free tier available at [console.groq.com](https://console.groq.com)) | `gsk_...` |
| `OPENAI_API_KEY` *(Alternative)* | OpenAI API Key (using `gpt-4o-mini`) | `sk-proj-...` |
| `DEEPSEEK_API_KEY` *(Alternative)* | DeepSeek API Key | `sk-...` |
| `DEMO_MODE` | Set `false` for production (or `true` only for presentation demos) | `false` |
| `FACILITATOR_URL` | Hosted x402 facilitator | `https://facilitator.goplausible.xyz` |

---

## 🛠️ Method 1: Deploying via Vercel CLI (Recommended)

1. Open your terminal in the project directory:
   ```bash
   cd contract-risk-tagger
   ```

2. Run the Vercel deployment command:
   ```bash
   npx vercel
   ```

3. Follow the CLI prompts:
   - **Set up and deploy?**: `y`
   - **Which scope?**: Select your account/team
   - **Link to existing project?**: `n`
   - **Project Name**: `cerberus-x402-analyzer` (or your preferred name)
   - **Directory**: `./`
   - **Want to modify settings?**: `n`

4. Add your Environment Variables:
   ```bash
   npx vercel env add GROQ_API_KEY production
   npx vercel env add AVM_ADDRESS production
   ```

5. Deploy to Production:
   ```bash
   npx vercel --prod
   ```

---

## 🐙 Method 2: Deploying via GitHub + Vercel Dashboard

1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "Configure CERBERUS for Vercel deployment"
   git push origin main
   ```

2. Open [Vercel Dashboard](https://vercel.com/new).
3. Import your GitHub repository.
4. Add Environment Variables (`GROQ_API_KEY`, `AVM_ADDRESS`).
5. Click **Deploy**.

---

## ⚡ Verification & Live Endpoints

Once deployed, your Vercel URL will serve all features:

- **Web UI**: `https://<your-project>.vercel.app`
- **x402 Protected Endpoint**: `POST https://<your-project>.vercel.app/analyze-contract`
- **Health Check**: `GET https://<your-project>.vercel.app/health`
- **Service Info**: `GET https://<your-project>.vercel.app/info`
