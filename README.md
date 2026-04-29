# 🚀 paysure

> **"Trust after payment — in 3 seconds."**

A merchant-side app that creates instant, shared, verifiable proof of payment. No customer app required.

---

## 📁 Project Structure

```
paysure/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variables template
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js
    │   ├── index.js
    │   ├── index.css
    │   ├── contexts/
    │   │   └── AuthContext.js
    │   ├── components/
    │   │   ├── Layout.js
    │   │   └── ProtectedRoute.js
    │   └── pages/
    │       ├── Login.js
    │       ├── Register.js
    │       ├── Dashboard.js
    │       ├── TransactionDetail.js
    │       ├── VerifyPayment.js
    │       └── VerifyRefund.js
    ├── package.json
    ├── tailwind.config.js
    └── postcss.config.js
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy + SQLite |
| Auth | JWT (email/password) |
| Payments | Razorpay Test Mode + Webhooks |
| SMS | Twilio |
| AI | OpenAI GPT-4 (insights) |
| Frontend | React + Tailwind CSS + qrcode.react |
| QR Codes | Client-side generation (qrcode.react) |

---

## 🚀 Quick Start

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your keys

# Run server
python main.py
# OR
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

The app will be available at `http://localhost:3000`.

---

## 🔑 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
SECRET_KEY=your-super-secret-key

# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_test_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Twilio
TWILIO_SID=your_twilio_sid
TWILIO_TOKEN=your_twilio_token
TWILIO_PHONE=+1234567890

# OpenAI (for AI Insights)
OPENAI_API_KEY=your_openai_api_key

# Database
DATABASE_URL=sqlite:///./paysure.db
```

---

## 📱 Features

### Merchant Dashboard
- Live transaction status
- QR code generation for customer verification
- 1-tap "Send Proof" via SMS
- 1-tap Refund with proof generation
- AI-powered daily insights

### Customer Verification (No App Required)
- Scan QR → opens web page
- Shows: Amount, UTR, Time, Status
- "Show to Merchant" button
- Cryptographic proof hash verification

### Dispute Shield
- Auto-generate structured proof
- Email/copy ready output
- Reduces 30 min manual work → 10 sec action

### Refund System
- Merchant taps → Refund processed
- Customer receives refund proof link
- Builds trust, prevents escalation

---

## 🔗 API Endpoints

### Auth
- `POST /api/auth/register` — Create merchant account
- `POST /api/auth/login` — Login, get JWT token
- `GET /api/auth/me` — Get current merchant

### Transactions
- `GET /api/transactions` — List merchant transactions
- `GET /api/transactions/{id}` — Get transaction details

### Webhooks
- `POST /api/webhooks/razorpay` — Razorpay payment webhooks

### Proof & Verification
- `POST /api/proof/generate` — Generate & send payment proof
- `GET /api/verify/{utr}` — Public: verify payment (customer-facing)

### Refunds
- `POST /api/refund` — Process refund
- `GET /api/refund/{refund_id}` — Public: verify refund (customer-facing)

### Insights
- `GET /api/insights/daily` — AI-generated daily summary

### Testing
- `POST /api/payments/create-order` — Create real razorpay order

---

## 🧪 Testing Flow

1. **Register** a merchant account at `/register`
2. **Login** at `/login`
3. Click **"Create Payment"** on the dashboard
4. See the transaction appear with status "captured"
5. Click **"Show QR"** — scan with your phone to see the customer verification page
6. Click **"Send Proof"** — enter a phone number to send SMS
7. Click **"Refund"** — enter a reason to process refund
8. Check **AI Insights** card for daily summary

---

## 📝 Razorpay Webhook Setup

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-ngrok-url/api/webhooks/razorpay`
3. Select events: `payment.captured`, `payment.failed`
4. Copy webhook secret to `.env`

For local testing, use [ngrok](https://ngrok.com/):
```bash
ngrok http 8000
```

---

## ⚠️ Limitations

- Requires aggregator APIs (Razorpay)
- Not all UPI flows covered
- Doesn't fix failed payments — only proves truth
- SMS requires Twilio credits
- AI insights require OpenAI API key (falls back to basic summary if unavailable)

---

## 💰 Business Model

- ₹99/month per merchant
- Can bundle with POS / soundbox

---

## 🧠 Positioning

> "Everyone is building ways to **pay**.
> We are building a way to **trust the payment**."

---

## 📄 License

MIT
