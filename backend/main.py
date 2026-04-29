"""
paysure - Trust after payment, in 3 seconds.
FastAPI backend with Razorpay, JWT auth, Twilio SMS, Groq AI, and Firebase Firestore.
"""
from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import Optional, List
import hashlib, hmac, jwt, os, sys, json, random, string
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ai.gemini_config import build_chat_prompt, DAILY_INSIGHTS_PROMPT, format_transactions
from firestore_db import (
    init_firebase, create_merchant, get_merchant_by_email, get_merchant_by_id,
    get_first_merchant, create_transaction, get_transaction, get_transactions,
    get_transaction_by_utr, get_transaction_by_order_id, get_transaction_by_payment_id,
    get_transaction_by_refund_id, update_transaction, get_daily_transactions
)

# ─── Configuration ───────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "paysure-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_xxxxxxxxxxxx")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "your_razorpay_test_secret")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "your_webhook_secret")
TWILIO_SID = os.getenv("TWILIO_SID", "your_twilio_sid")
TWILIO_TOKEN = os.getenv("TWILIO_TOKEN", "your_twilio_token")
TWILIO_PHONE = os.getenv("TWILIO_PHONE", "+1234567890")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

razorpay_client = None
try:
    import razorpay
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_ID != "rzp_test_xxxxxxxxxxxx":
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
except ImportError:
    pass

groq_client = None
try:
    from groq import Groq
    if GROQ_API_KEY:
        groq_client = Groq(api_key=GROQ_API_KEY)
except ImportError:
    print("WARNING: groq not installed. AI features disabled.")

GROQ_MODEL = "llama-3.3-70b-versatile"

# Initialize Firebase
firebase_ok = False
try:
    init_firebase()
    firebase_ok = True
except Exception as e:
    print(f"WARNING: Firebase init failed: {e}")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# ─── Pydantic Schemas ────────────────────────────────────────────────────────
class MerchantCreate(BaseModel):
    email: EmailStr
    password: str
    business_name: str
    phone: str

class MerchantLogin(BaseModel):
    email: EmailStr
    password: str

class MerchantResponse(BaseModel):
    id: str
    email: str
    business_name: str
    phone: str
    created_at: datetime

class TransactionResponse(BaseModel):
    id: str
    amount: float
    currency: str
    utr: str
    status: str
    customer_phone: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    proof_hash: Optional[str] = None
    refund_id: Optional[str] = None

class RefundRequest(BaseModel):
    transaction_id: str
    amount: Optional[float] = None
    reason: str

class ProofRequest(BaseModel):
    transaction_id: str
    customer_phone: Optional[str] = None

class SMSSendRequest(BaseModel):
    phone: str
    message: str

class CreateOrderRequest(BaseModel):
    amount: float
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    description: Optional[str] = "UPI Payment"

class PaymentConfirmRequest(BaseModel):
    transaction_id: str
    razorpay_payment_id: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []
    transactions: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    reply: str

# ─── Helpers ─────────────────────────────────────────────────────────────────
def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def hash_password(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def _txn_response(t: dict) -> dict:
    """Convert a Firestore txn dict to a TransactionResponse-compatible dict."""
    d = dict(t)
    # Ensure created_at is a datetime
    if d.get("created_at") and not isinstance(d["created_at"], datetime):
        d["created_at"] = datetime.utcnow()
    if not d.get("created_at"):
        d["created_at"] = datetime.utcnow()
    return d

def get_current_merchant(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        merchant = get_first_merchant()
        if not merchant:
            merchant = create_merchant({
                "email": "sharma.store@gmail.com",
                "hashed_password": "demo",
                "business_name": "Sharma General Store",
                "phone": "+919810233421",
                "razorpay_key_id": os.getenv("RAZORPAY_KEY_ID", "rzp_test_SjPsXMmj345aei"),
                "razorpay_key_secret": os.getenv("RAZORPAY_KEY_SECRET", "5V769lVZJTc4iuZO44PLldBM"),
            })
        return merchant

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    merchant = get_merchant_by_email(email)
    if merchant is None:
        raise HTTPException(status_code=401, detail="Merchant not found")
    return merchant

def generate_utr():
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"UTR{timestamp}{random_suffix}"

def generate_proof_hash(utr: str, amount: float, timestamp: str, secret: str = SECRET_KEY):
    message = f"{utr}:{amount}:{timestamp}"
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()[:16]

def send_sms(phone: str, message: str):
    try:
        from twilio.rest import Client as TwilioClient
        client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
        msg = client.messages.create(body=message, from_=TWILIO_PHONE, to=phone)
        return {"success": True, "sid": msg.sid}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def generate_ai_summary(merchant_id: str):
    txns = get_daily_transactions(merchant_id)
    delayed = sum(1 for t in txns if t.get("status") == "pending")
    failed = sum(1 for t in txns if t.get("status") == "failed")
    refunded = sum(1 for t in txns if t.get("status") == "refunded")
    total_amount = sum(t.get("amount", 0) for t in txns if t.get("status") == "captured")
    pending_amount = sum(t.get("amount", 0) for t in txns if t.get("status") == "pending")
    summary = f"Today:\n- {delayed} delayed\n- {failed} failed\n- {refunded} refunds\n- ₹{total_amount:.2f} received\n- ₹{pending_amount:.2f} pending"
    if groq_client:
        try:
            prompt = f"{DAILY_INSIGHTS_PROMPT}\nData: {len(txns)} txns, {delayed} delayed, {failed} failed, {refunded} refunds, ₹{total_amount:.2f} received, ₹{pending_amount:.2f} pending"
            response = groq_client.chat.completions.create(model=GROQ_MODEL, messages=[{"role":"system","content":DAILY_INSIGHTS_PROMPT},{"role":"user","content":prompt}], temperature=0.7, max_tokens=300)
            if response and response.choices:
                summary = response.choices[0].message.content
        except Exception as e:
            print(f"Groq insights error: {e}")
    return summary

def get_fallback_reply(question: str) -> str:
    q = question.lower()
    if "refund" in q: return "Tap any duplicate transaction → 'Refund Duplicate Payment'. Money returns instantly via UPI."
    if "settle" in q: return "Today's settlement so far: ₹12,480. It credits to your bank by 10 PM."
    if "verify" in q or "verifying" in q: return "A payment shows VERIFYING when the bank hasn't sent us a final confirmation. Usually clears in 3 seconds."
    if "duplicate" in q: return "Duplicates occur when a customer's UPI app sends the same payment request twice within 60 seconds. You should refund one of them."
    if "disput" in q: return "I can see your disputed transactions. To resolve them, check the duplicate entries and initiate a refund for the extra payment."
    return "I'm running in offline mode. Add your GROQ_API_KEY to backend/.env for full AI-powered insights!"

# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(title="paysure API", description="Trust after payment — in 3 seconds", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ─── AI Chat ─────────────────────────────────────────────────────────────────
@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(req: ChatRequest):
    if not groq_client:
        return ChatResponse(reply=get_fallback_reply(req.message))
    try:
        messages = build_chat_prompt(transactions=req.transactions, user_message=req.message, history=req.history)
        response = groq_client.chat.completions.create(model=GROQ_MODEL, messages=messages, temperature=0.7, max_tokens=500)
        reply = response.choices[0].message.content if response and response.choices else "Sorry, I couldn't process that."
        return ChatResponse(reply=reply)
    except Exception as e:
        print(f"Groq chat error: {e}")
        return ChatResponse(reply="I'm having trouble connecting right now. Please try again in a moment.")

# ─── Auth Routes ─────────────────────────────────────────────────────────────
@app.post("/api/auth/register")
def register(merchant: MerchantCreate):
    existing = get_merchant_by_email(merchant.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    m = create_merchant({
        "email": merchant.email,
        "hashed_password": hash_password(merchant.password),
        "business_name": merchant.business_name,
        "phone": merchant.phone
    })
    return MerchantResponse(id=m["id"], email=m["email"], business_name=m["business_name"], phone=m["phone"], created_at=m["created_at"])

@app.post("/api/auth/login")
def login(creds: MerchantLogin):
    merchant = get_merchant_by_email(creds.email)
    if not merchant or not verify_password(creds.password, merchant["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": merchant["email"], "merchant_id": merchant["id"]})
    resp = MerchantResponse(id=merchant["id"], email=merchant["email"], business_name=merchant["business_name"], phone=merchant["phone"], created_at=merchant["created_at"])
    return {"access_token": token, "token_type": "bearer", "merchant": resp}

@app.get("/api/auth/me")
def get_me(current: dict = Depends(get_current_merchant)):
    return MerchantResponse(id=current["id"], email=current["email"], business_name=current["business_name"], phone=current["phone"], created_at=current.get("created_at", datetime.utcnow()))

# ─── Transaction Routes ──────────────────────────────────────────────────────
@app.get("/api/transactions")
def list_transactions(status: Optional[str] = None, limit: int = 50, current: dict = Depends(get_current_merchant)):
    txns = get_transactions(current["id"], status=status, limit=limit)
    return [TransactionResponse(**_txn_response(t)) for t in txns]

@app.get("/api/transactions/{transaction_id}")
def get_single_transaction(transaction_id: str, current: dict = Depends(get_current_merchant)):
    txn = get_transaction(transaction_id, current["id"])
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return TransactionResponse(**_txn_response(txn))

# ─── Razorpay Webhook ────────────────────────────────────────────────────────
@app.post("/api/webhooks/razorpay/{merchant_id}")
async def razorpay_webhook(merchant_id: str, request: Request, background_tasks: BackgroundTasks):
    merchant = get_merchant_by_id(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    webhook_secret = merchant.get("razorpay_webhook_secret") or RAZORPAY_WEBHOOK_SECRET
    import razorpay as rp
    client = rp.Client(auth=("", ""))
    try:
        client.utility.verify_webhook_signature(body.decode("utf-8"), signature, webhook_secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    data = json.loads(body)
    event = data.get("event", "")
    payload = data.get("payload", {}).get("payment", {}).get("entity", {})

    if event in ["payment.captured", "payment.authorized"]:
        razorpay_id = payload.get("id")
        order_id = payload.get("order_id")
        amount = payload.get("amount", 0) / 100
        contact = payload.get("contact")
        email = payload.get("email")
        st = "captured" if event == "payment.captured" else "authorized"
        txn = get_transaction_by_order_id(order_id) if order_id else None
        if not txn and razorpay_id:
            txn = get_transaction_by_payment_id(razorpay_id)
        if txn:
            update_transaction(txn["id"], {"status": st, "razorpay_payment_id": razorpay_id})
        else:
            utr = generate_utr()
            txn = create_transaction({"merchant_id": merchant["id"], "amount": amount, "utr": utr, "status": st, "razorpay_payment_id": razorpay_id, "razorpay_order_id": order_id, "customer_phone": contact, "customer_email": email, "description": "Static QR Payment"})
        if st == "captured" and not txn.get("proof_hash"):
            ph = generate_proof_hash(txn["utr"], amount, datetime.utcnow().isoformat())
            update_transaction(txn["id"], {"proof_hash": ph})
        return {"status": "success", "transaction_id": txn["id"], "utr": txn["utr"]}
    elif event == "payment.failed":
        order_id = payload.get("order_id")
        txn = get_transaction_by_order_id(order_id) if order_id else None
        if txn:
            update_transaction(txn["id"], {"status": "failed", "razorpay_payment_id": payload.get("id")})
        return {"status": "failed_recorded"}
    return {"status": "ignored", "event": event}

# ─── Proof & Verification ────────────────────────────────────────────────────
@app.post("/api/proof/generate")
def generate_proof(req: ProofRequest, background_tasks: BackgroundTasks, current: dict = Depends(get_current_merchant)):
    txn = get_transaction(req.transaction_id, current["id"])
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if not txn.get("proof_hash"):
        ph = generate_proof_hash(txn["utr"], txn["amount"], datetime.utcnow().isoformat())
        update_transaction(txn["id"], {"proof_hash": ph})
        txn["proof_hash"] = ph
    base_url = os.getenv("FRONTEND_URL", "https://settleproof.com")
    verify_url = f"{base_url}/v/{txn['utr']}"
    phone = req.customer_phone or txn.get("customer_phone")
    if phone:
        msg = f"Your payment of Rs.{txn['amount']:.2f} to {current['business_name']} is confirmed. Verify: {verify_url}"
        background_tasks.add_task(send_sms, phone, msg)
    return {"verification_url": verify_url, "utr": txn["utr"]}

@app.get("/api/verify/{utr}")
def verify_payment(utr: str):
    txn = get_transaction_by_utr(utr)
    if not txn:
        raise HTTPException(status_code=404, detail="Payment not found")
    merchant = get_merchant_by_id(txn["merchant_id"])
    ts = txn.get("created_at", datetime.utcnow())
    if isinstance(ts, datetime):
        ts = ts.isoformat()
    expected_hash = generate_proof_hash(txn["utr"], txn["amount"], ts)
    is_valid = hmac.compare_digest(expected_hash, txn.get("proof_hash") or "")
    return {"valid": is_valid, "amount": txn["amount"], "currency": txn.get("currency","INR"), "utr": txn["utr"], "status": txn["status"], "merchant_name": merchant["business_name"] if merchant else "Unknown", "timestamp": txn.get("created_at"), "description": txn.get("description"), "refund_id": txn.get("refund_id"), "refund_amount": txn.get("refund_amount")}

# ─── Refund ──────────────────────────────────────────────────────────────────
@app.post("/api/refund")
async def process_refund(req: RefundRequest, background_tasks: BackgroundTasks, current: dict = Depends(get_current_merchant)):
    txn = get_transaction(req.transaction_id, current["id"])
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn["status"] != "captured":
        raise HTTPException(status_code=400, detail="Can only refund captured payments")
    refund_amount = req.amount or txn["amount"]
    if razorpay_client and txn.get("razorpay_payment_id"):
        try:
            refund_res = razorpay_client.payment.refund(txn["razorpay_payment_id"], {"amount": int(refund_amount * 100), "notes": {"reason": req.reason}})
            refund_id = refund_res.get("id")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Refund failed: {str(e)}")
    else:
        refund_id = f"rfnd_sim_{generate_utr()}"
    update_transaction(txn["id"], {"status": "refunded", "refund_id": refund_id, "refund_amount": refund_amount, "refund_reason": req.reason})
    refund_url = f"https://settleproof.com/r/{refund_id}"
    if txn.get("customer_phone"):
        background_tasks.add_task(send_sms, txn["customer_phone"], f"Refund of ₹{refund_amount:.2f} from {current['business_name']} processed. Track: {refund_url}")
    return {"success": True, "refund_id": refund_id, "amount": refund_amount, "reason": req.reason, "refund_url": refund_url, "transaction_id": txn["id"]}

@app.get("/api/refund/{refund_id}")
def get_refund(refund_id: str):
    txn = get_transaction_by_refund_id(refund_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Refund not found")
    merchant = get_merchant_by_id(txn["merchant_id"])
    return {"refund_id": refund_id, "amount": txn.get("refund_amount"), "original_amount": txn["amount"], "reason": txn.get("refund_reason"), "status": txn["status"], "merchant_name": merchant["business_name"] if merchant else "Unknown", "timestamp": txn.get("updated_at"), "original_utr": txn["utr"]}

# ─── AI Insights ─────────────────────────────────────────────────────────────
@app.get("/api/insights/daily")
async def get_daily_insights(current: dict = Depends(get_current_merchant)):
    summary = await generate_ai_summary(current["id"])
    return {"merchant_id": current["id"], "date": datetime.utcnow().date().isoformat(), "summary": summary, "generated_at": datetime.utcnow().isoformat()}

# ─── Simulate Webhook (Demo) ─────────────────────────────────────────────────
@app.post("/api/test/simulate-webhook")
async def simulate_webhook(background_tasks: BackgroundTasks, current: dict = Depends(get_current_merchant)):
    amount = float(random.choice([150, 450, 1299, 240, 50, 999]))
    razorpay_payment_id = f"pay_{''.join(random.choices(string.ascii_letters + string.digits, k=14))}"
    utr = generate_utr()
    proof_hash = generate_proof_hash(utr, amount, datetime.utcnow().isoformat())
    txn = create_transaction({"merchant_id": current["id"], "amount": amount, "utr": utr, "razorpay_payment_id": razorpay_payment_id, "status": "captured", "customer_phone": "+919876543210", "description": "Static QR UPI Payment (Simulated)", "proof_hash": proof_hash})
    return {"success": True, "message": "Simulated Webhook Received", "transaction": TransactionResponse(**_txn_response(txn))}

# ─── Reconciliation ──────────────────────────────────────────────────────────
@app.get("/api/reconcile")
def reconcile(current: dict = Depends(get_current_merchant)):
    txns = get_daily_transactions(current["id"])
    captured = [t for t in txns if t.get("status") == "captured"]
    pending = [t for t in txns if t.get("status") in ["pending", "authorized"]]
    failed = [t for t in txns if t.get("status") == "failed"]
    refunded = [t for t in txns if t.get("status") == "refunded"]
    missing = [{"utr": t["utr"], "amount": t["amount"], "status": t["status"]} for t in pending + failed]
    return {"date": datetime.utcnow().strftime("%d %B %Y"), "total_transactions": len(txns), "captured_count": len(captured), "captured_amount": sum(t["amount"] for t in captured), "pending_count": len(pending), "pending_amount": sum(t["amount"] for t in pending), "failed_count": len(failed), "refunded_count": len(refunded), "missing": missing}

# ─── Razorpay Payment Creation ───────────────────────────────────────────────
@app.post("/api/payments/create-order")
def create_order(req: CreateOrderRequest, current: dict = Depends(get_current_merchant)):
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Razorpay not configured")
    order_data = {"amount": int(req.amount * 100), "currency": "INR", "receipt": f"receipt_{current['id']}_{int(datetime.utcnow().timestamp())}"}
    try:
        mk, ms = current.get("razorpay_key_id"), current.get("razorpay_key_secret")
        if mk and ms:
            mc = razorpay.Client(auth=(mk, ms))
            razorpay_order = mc.order.create(data=order_data)
        else:
            razorpay_order = razorpay_client.order.create(data=order_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    utr = generate_utr()
    txn = create_transaction({"merchant_id": current["id"], "amount": req.amount, "utr": utr, "status": "pending", "razorpay_order_id": razorpay_order["id"], "customer_phone": req.customer_phone, "customer_email": req.customer_email, "description": req.description})
    return {"success": True, "transaction": TransactionResponse(**_txn_response(txn)), "razorpay_order_id": razorpay_order["id"], "key_id": current.get("razorpay_key_id") or RAZORPAY_KEY_ID}

@app.post("/api/payments/confirm")
def confirm_payment(req: PaymentConfirmRequest, background_tasks: BackgroundTasks, current: dict = Depends(get_current_merchant)):
    txn = get_transaction(req.transaction_id, current["id"])
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn["status"] != "captured":
        ph = generate_proof_hash(txn["utr"], txn["amount"], datetime.utcnow().isoformat()) if not txn.get("proof_hash") else txn["proof_hash"]
        update_transaction(txn["id"], {"status": "captured", "razorpay_payment_id": req.razorpay_payment_id, "proof_hash": ph})
        verify_url = f"https://settleproof.com/v/{txn['utr']}"
        if txn.get("customer_phone"):
            background_tasks.add_task(send_sms, txn["customer_phone"], f"Payment of Rs.{txn['amount']:.2f} to {current['business_name']} confirmed. Verify: {verify_url}")
        if current.get("phone"):
            background_tasks.add_task(send_sms, current["phone"], f"PaySure: Received Rs.{txn['amount']:.2f}. UTR: {txn['utr']}. Verify: {verify_url}")
    return {"success": True}

# ─── Health Check ────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "paysure", "version": "1.0.0", "groq_configured": groq_client is not None, "razorpay_configured": razorpay_client is not None, "firebase_configured": firebase_ok}

# ─── Main ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
