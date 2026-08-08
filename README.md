CERBERUS — Contract Clause Risk Tagger
=======================================

AI-powered contract risk analysis with blockchain-native payments using x402 and Algorand.

CERBERUS is an AI-powered legal contract analyzer that identifies potentially risky clauses in contracts, explains why they are risky, and suggests safer alternatives.

The project combines local AI inference with a payment-gated API powered by the x402 payment protocol and Algorand Testnet USDC.

The goal is simple:

Analyze a contract → identify risks → explain them → suggest safer wording → pay per analysis.


--------------------------------------------------
WHY CERBERUS?
--------------------------------------------------

Legal contracts can contain clauses that create significant financial, operational, or legal risks.

Examples include:

- Unlimited indemnification
- Excessive liability limitations
- Broad intellectual-property assignments
- Unfair termination clauses
- Long or unrestricted non-compete clauses
- Unclear governing-law provisions

CERBERUS uses an AI model to analyze contract text and return structured risk findings.

Instead of simply highlighting suspicious text, it provides:

- The risky clause
- Risk level
- Explanation of the risk
- Suggested safer wording


--------------------------------------------------
CORE CONCEPT
--------------------------------------------------

CERBERUS is designed around a payment-gated AI architecture.

The AI analysis endpoint is not directly exposed to users.

A request first passes through an x402 payment gateway.

The gateway:

1. Receives the analysis request
2. Returns HTTP 402 when payment is required
3. Provides payment requirements
4. Accepts a valid Algorand Testnet USDC transaction
5. Verifies the transaction
6. Proxies the request to the protected AI backend
7. Returns the AI-generated analysis

This creates a simple pay-per-analysis model for AI services.


--------------------------------------------------
ARCHITECTURE
--------------------------------------------------

                         USER
                           |
                           v
                 +-------------------+
                 |     Frontend      |
                 |   Browser :8000   |
                 +---------+---------+
                           |
                           v
                 +-------------------+
                 |   x402 Gateway    |
                 |    Node.js :4021  |
                 +---------+---------+
                           |
                  Payment Required?
                    /           \
                  YES            NO
                   |              |
                   v              |
             HTTP 402             |
             Payment Info         |
                   |              |
                   v              |
             Algorand USDC        |
             Payment              |
                   |              |
                   v              |
             Transaction ID       |
                   |              |
                   v              |
          On-chain Verification   |
                   |              |
                   +------+-------+
                          |
                          v
                 +-------------------+
                 |   Python Backend  |
                 | FastAPI :8000     |
                 | localhost only    |
                 +---------+---------+
                           |
                           v
                 +-------------------+
                 | Ollama + Mistral  |
                 | Local AI Inference|
                 +---------+---------+
                           |
                           v
                    Risk Analysis
                           |
                           v
                         USER


--------------------------------------------------
AI ANALYSIS
--------------------------------------------------

CERBERUS uses Ollama for local AI inference.

Default model:

mistral:latest

The AI receives contract text and is instructed to return structured JSON.

Each identified risk contains:

- clause
- risk_level
- reason
- suggested_rewrite

Supported risk levels:

- high
- medium
- low

The backend also normalizes model output to maintain a predictable response structure.


--------------------------------------------------
DOCUMENT SUPPORT
--------------------------------------------------

CERBERUS can extract contract text from multiple document formats.

Supported formats include:

- PDF
- DOC
- DOCX
- ODT
- RTF
- HTML
- TXT
- Markdown
- CSV
- TSV
- JSON
- LOG

Uploaded files are processed by the backend before being sent to the AI analysis layer.


--------------------------------------------------
x402 PAYMENT SYSTEM
--------------------------------------------------

CERBERUS uses the x402 payment protocol to create a payment-gated AI service.

When a user requests an analysis without payment, the gateway responds with HTTP 402 and provides the payment requirements.

The current payment configuration uses:

Network:
Algorand Testnet

Asset:
USDC

Price:
$0.01 per analysis

Payment verification includes checks for:

- Correct asset
- Correct receiver
- Minimum payment amount
- Recent transaction
- Valid transaction structure
- Transaction replay protection


--------------------------------------------------
BLOCKCHAIN
--------------------------------------------------

Blockchain network:

Algorand Testnet

Payment asset:

USDC

USDC ASA:

10458941

Payment receiver:

2TXWLUCA3XVUNDNEFSI6GNSFDD7KXZMQDAWJOYKTZMBMXNZWTXYT73AGCU


--------------------------------------------------
SECURITY MODEL
--------------------------------------------------

Security is a core part of the architecture.

The AI backend is bound to:

127.0.0.1

This prevents direct external access to the AI service.

The x402 gateway is responsible for payment verification before forwarding requests to the AI backend.

Internal requests are authenticated using:

X-Internal-Secret

The secret is loaded from the environment and has no hardcoded fallback.

Additional security measures include:

- Localhost-only AI backend
- Internal secret authentication
- Timing-safe secret comparison
- Restricted CORS configuration
- Upload size limits
- Transaction validation
- Transaction replay protection
- Error responses without internal stack traces
- Disabled public Swagger/ReDoc documentation
- Payment verification before AI execution


--------------------------------------------------
DEMO MODE
--------------------------------------------------

CERBERUS includes a demo mode for hackathon demonstrations.

When:

DEMO_MODE=true

the configured demo transaction ID can be accepted for instant execution without requiring a live wallet or indexer flow.

For strict blockchain verification, use:

DEMO_MODE=false

This forces transaction verification for all submitted transaction IDs.


--------------------------------------------------
TECH STACK
--------------------------------------------------

Frontend:
Vanilla HTML
CSS
JavaScript

AI Backend:
Python
FastAPI
Ollama
Mistral

Payment Gateway:
Node.js
TypeScript
Hono
x402

Blockchain:
Algorand Testnet
USDC

Document Processing:
pypdf
python-docx

Infrastructure:
Vercel-compatible deployment configuration


--------------------------------------------------
PROJECT STRUCTURE
--------------------------------------------------

contract-risk-tagger/
|
+-- backend/
|   +-- main.py
|   +-- .env.example
|
+-- frontend/
|   +-- index.html
|
+-- x402-server/
|   +-- handlers/
|   |   +-- contract-analysis.ts
|   +-- index.ts
|   +-- .env.example
|
+-- api/
|
+-- check_status.py
+-- start.ps1
+-- package.json
+-- package-lock.json
+-- tsconfig.json
+-- vercel.json
+-- VERCEL_DEPLOYMENT.md
+-- README.md


--------------------------------------------------
ENVIRONMENT VARIABLES
--------------------------------------------------

The backend requires an INTERNAL_SECRET.

Create:

backend/.env

Example:

INTERNAL_SECRET=your-long-random-secret
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:latest
OLLAMA_TIMEOUT=180
ALLOWED_ORIGIN=http://localhost:4021


The x402 server requires the same internal secret.

Create:

x402-server/.env

Example:

INTERNAL_SECRET=your-long-random-secret

AVM_ADDRESS=your-algorand-wallet-address

DEMO_MODE=true

DEMO_TXID=your-demo-transaction-id


IMPORTANT:

The INTERNAL_SECRET used by the backend and x402 server must be identical.

Never commit real .env files or private credentials to GitHub.


--------------------------------------------------
LOCAL SETUP
--------------------------------------------------

1. Clone the repository

git clone https://github.com/venkataramavinaybandla-crypto/Block_Hack_Hackathon.git

cd Block_Hack_Hackathon/contract-risk-tagger


2. Install Node dependencies

npm install


3. Install Python dependencies

pip install fastapi uvicorn httpx python-dotenv pypdf python-docx


4. Install and run Ollama

Make sure Ollama is running locally.

Pull the model:

ollama pull mistral:latest


5. Configure environment variables

Create:

backend/.env

and:

x402-server/.env

Use the same INTERNAL_SECRET in both files.


6. Start the project

PowerShell:

.\start.ps1


Or start the services manually.

Terminal 1:

cd backend

uvicorn main:app --host 127.0.0.1 --port 8000 --reload


Terminal 2:

cd x402-server

npm run dev


7. Open the application

http://localhost:8000


--------------------------------------------------
PAYMENT FLOW
--------------------------------------------------

1. User opens CERBERUS.

2. User uploads or enters a contract.

3. User requests analysis.

4. x402 gateway checks whether the request contains valid payment information.

5. If payment is missing, the gateway returns:

HTTP 402 Payment Required

6. The response contains the payment requirements.

7. User submits the required USDC payment on Algorand Testnet.

8. User provides the transaction ID.

9. CERBERUS verifies the transaction.

10. Once payment is verified, the gateway forwards the contract to the protected AI backend.

11. Ollama analyzes the contract.

12. CERBERUS returns the identified risks and suggested rewrites.


--------------------------------------------------
API ENDPOINTS
--------------------------------------------------

Python Backend:

GET /health

Returns backend health information.


GET /metrics

Returns basic operational metrics.


GET /sample-contract

Returns a sample contract for testing.


POST /analyze-contract

Analyzes contract text using the AI model.

This endpoint requires the internal gateway authentication header.


POST /extract-document

Extracts text from supported uploaded documents.


--------------------------------------------------
SECURITY TESTING
--------------------------------------------------

The project includes security-oriented testing for the payment and backend flow.

Run:

python test_paid_flow.py

The test suite is designed to fail if expected security checks do not pass.


--------------------------------------------------
DESIGN PRINCIPLE
--------------------------------------------------

CERBERUS separates three responsibilities:

AI
----
Analyze the contract and identify risks.

Payment
-------
Verify that the user has paid for the requested analysis.

Gateway
-------
Control access between the user and the AI backend.


This separation prevents the AI service from becoming a directly exposed public endpoint while allowing the project to operate as a payment-gated AI service.


--------------------------------------------------
FUTURE DEVELOPMENT
--------------------------------------------------

Potential future improvements include:

- Mainnet payment support
- Additional blockchain payment options
- Multiple AI models
- Larger document processing pipeline
- OCR for scanned contracts
- Contract comparison
- Clause-by-clause scoring
- Risk trend dashboards
- Persistent analysis history
- Enterprise authentication
- Multi-user accounts
- Advanced legal-domain models
- Production-grade transaction indexing
- Usage-based API billing


--------------------------------------------------
DISCLAIMER
--------------------------------------------------

CERBERUS is an AI-powered contract analysis tool intended for educational, research, and informational purposes.

It does not provide legal advice and should not replace review by a qualified legal professional.


--------------------------------------------------
HACKATHON PROJECT
--------------------------------------------------

CERBERUS was developed as a blockchain + AI hackathon project exploring how AI services can be combined with decentralized payment infrastructure.

Core technologies:

AI
FastAPI
Ollama
Mistral
x402
Algorand
USDC
Hono
TypeScript
Python


Built for experimentation with AI-powered services and blockchain-native payments.
