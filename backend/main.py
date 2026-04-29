"""
paysure - Trust after payment, in 3 seconds.
FastAPI backend with Razorpay test webhooks, JWT auth, Twilio SMS, and Groq AI insights.
"""

from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import Optional, List
import hashlib
import hmac
import jwt
import os
import sys
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
import json
import random
import string
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# Add parent dir to path so we can import from ai/ (works both locally and on Render)
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ai.gemini_config import build_chat_prompt, DAILY_INSIGHTS_PROMPT, format_transactions

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

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./paysure.db")

# Razorpay client (only init if keys are real)
razorpay_client = None
try:
    import razorpay
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_ID != "rzp_test_xxxxxxxxxxxx":
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
except ImportError:
    pass

# Groq client
groq_client = None
try:
    from groq import Groq
    if GROQ_API_KEY:
        groq_client = Groq(api_key=GROQ_API_KEY)
except ImportError:
    print("WARNING: groq not installed. AI features disabled.")

GROQ_MODEL = "llama-3.3-70b-versatile"

# ─── Database Setup ──────────────────────────────────────────────────────────
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# ─── Models ──────────────────────────────────────────────────────────────────
class Merchant(Base):
    __tablename__ = "merchants"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    business_name = Column(String)
    phone = Column(String)
    razorpay_key_id = Column(String, nullable=True)
    razorpay_key_secret = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    transactions = relationship("Transaction", back_populates="merchant")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"))
    amount = Column(Float)
    currency = Column(String, default="INR")
    utr = Column(String, unique=True, index=True)
    razorpay_payment_id = Column(String, nullable=True)
    razorpay_order_id = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, captured, failed, refunded
    customer_phone = Column(String, nullable=True)
    customer_email = Column(String, nullable=True)
    description = Column(String, nullable=True)
    proof_hash = Column(String, nullable=True)
    refund_id = Column(String, nullable=True)
    refund_amount = Column(Float, nullable=True)
    refund_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    merchant = relationship("Merchant", back_populates="transactions")

class DisputeLog(Base):
    __tablename__ = "dispute_logs"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    merchant_id = Column(Integer, ForeignKey("merchants.id"))
    reason = Column(Text)
    resolution = Column(String, nullable=True)
    proof_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

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
    id: int
    email: str
    business_name: str
    phone: str
    created_at: datetime

    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    id: int
    amount: float
    currency: str
    utr: str
    status: str
    customer_phone: Optional[str]
    description: Optional[str]
    created_at: datetime
    proof_hash: Optional[str]
    refund_id: Optional[str]

    class Config:
        from_attributes = True

class PaymentWebhook(BaseModel):
    event: str
    payload: dict

class RefundRequest(BaseModel):
    transaction_id: int
    amount: Optional[float] = None
    reason: str

class ProofRequest(BaseModel):
    transaction_id: int
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
    transaction_id: int
    razorpay_payment_id: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []
    transactions: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    reply: str

# ─── Helpers ─────────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def hash_password(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_merchant(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    if credentials is None:
        merchant = db.query(Merchant).first()
        if not merchant:
            merchant = Merchant(
                email="sharma.store@gmail.com", 
                hashed_password="demo", 
                business_name="Sharma General Store", 
                phone="+919810233421",
                razorpay_key_id=os.getenv("RAZORPAY_KEY_ID", "rzp_test_SjPsXMmj345aei"),
                razorpay_key_secret=os.getenv("RAZORPAY_KEY_SECRET", "5V769lVZJTc4iuZO44PLldBM"),
                razorpay_webhook_secret=os.getenv("RAZORPAY_WEBHOOK_SECRET", "aigk_3D2otCURGXKm5rHt2Prn1qzrCZG")
            )
            db.add(merchant)
            db.commit()
            db.refresh(merchant)
        return merchant

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    merchant = db.query(Merchant).filter(Merchant.email == email).first()
    if merchant is None:
        raise HTTPException(status_code=401, detail="Merchant not found")
    return merchant

def generate_utr():
    """Generate a unique UTR-like identifier"""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"UTR{timestamp}{random_suffix}"

def generate_proof_hash(utr: str, amount: float, timestamp: str, secret: str = SECRET_KEY):
    """Generate HMAC proof hash for verification"""
    message = f"{utr}:{amount}:{timestamp}"
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()[:16]

def send_sms(phone: str, message: str):
    """Send SMS via Twilio"""
    try:
        from twilio.rest import Client as TwilioClient
        client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
        msg = client.messages.create(
            body=message,
            from_=TWILIO_PHONE,
            to=phone
        )
        return {"success": True, "sid": msg.sid}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def generate_ai_summary(merchant_id: int, db: Session):
    """Generate AI insight summary for merchant using Groq"""
    today = datetime.utcnow().date()
    transactions = db.query(Transaction).filter(
        Transaction.merchant_id == merchant_id,
        Transaction.created_at >= today
    ).all()

    delayed = sum(1 for t in transactions if t.status == "pending")
    failed = sum(1 for t in transactions if t.status == "failed")
    refunded = sum(1 for t in transactions if t.status == "refunded")
    total_amount = sum(t.amount for t in transactions if t.status == "captured")
    pending_amount = sum(t.amount for t in transactions if t.status == "pending")

    summary = f"""Today:
- {delayed} delayed confirmations
- {failed} failed transactions
- {refunded} refunds processed
- ₹{total_amount:.2f} successfully received
- ₹{pending_amount:.2f} pending confirmation"""

    # Enhance with Groq if available
    if groq_client:
        try:
            prompt = f"""{DAILY_INSIGHTS_PROMPT}

Data:
- Total transactions today: {len(transactions)}
- Delayed confirmations: {delayed}
- Failed transactions: {failed}
- Refunds: {refunded}
- Amount received: ₹{total_amount:.2f}
- Pending amount: ₹{pending_amount:.2f}"""

            response = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": DAILY_INSIGHTS_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=300,
            )
            if response and response.choices:
                summary = response.choices[0].message.content
        except Exception as e:
            print(f"Groq insights error: {e}")
            # Fallback to basic summary

    return summary

# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="paysure API",
    description="Trust after payment — in 3 seconds",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000", "http://127.0.0.1:8080", os.getenv("FRONTEND_URL", "http://localhost:8080")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── AI Chat Endpoint ───────────────────────────────────────────────────────
@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(req: ChatRequest):
    """Chat with PaySure Help — Groq-powered transaction insights"""
    if not groq_client:
        # Fallback responses when Groq is not configured
        return ChatResponse(reply=get_fallback_reply(req.message))

    try:
        # Build context-aware prompt with transaction data
        messages = build_chat_prompt(
            transactions=req.transactions,
            user_message=req.message,
            history=req.history
        )

        try:
            # Call Groq
            response = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=500,
            )
            reply = response.choices[0].message.content if response and response.choices else "Sorry, I couldn't process that. Please try again."
            return ChatResponse(reply=reply)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate_limit" in err_str.lower():
                return ChatResponse(reply="[Rate Limited] " + get_fallback_reply(req.message))
            else:
                raise e

    except Exception as e:
        print(f"Groq chat error: {e}")
        return ChatResponse(reply=f"I'm having trouble connecting right now. Please try again in a moment.")



def get_fallback_reply(question: str) -> str:
    """Fallback replies when Gemini API is not configured."""
    q = question.lower()
    if "refund" in q:
        return "Tap any duplicate transaction → 'Refund Duplicate Payment'. Money returns instantly via UPI."
    if "settle" in q:
        return "Today's settlement so far: ₹12,480. It credits to your bank by 10 PM."
    if "verify" in q or "verifying" in q:
        return "A payment shows VERIFYING when the bank hasn't sent us a final confirmation. Usually clears in 3 seconds."
    if "duplicate" in q:
        return "Duplicates occur when a customer's UPI app sends the same payment request twice within 60 seconds. You should refund one of them."
    if "disput" in q:
        return "I can see your disputed transactions. To resolve them, check the duplicate entries and initiate a refund for the extra payment."
    return "I'm running in offline mode (no Groq API key configured). Add your GROQ_API_KEY to backend/.env for full AI-powered insights!"


# ─── Auth Routes ─────────────────────────────────────────────────────────────
@app.post("/api/auth/register", response_model=MerchantResponse)
def register(merchant: MerchantCreate, db: Session = Depends(get_db)):
    existing = db.query(Merchant).filter(Merchant.email == merchant.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_merchant = Merchant(
        email=merchant.email,
        hashed_password=hash_password(merchant.password),
        business_name=merchant.business_name,
        phone=merchant.phone
    )
    db.add(db_merchant)
    db.commit()
    db.refresh(db_merchant)
    return db_merchant

@app.post("/api/auth/login")
def login(creds: MerchantLogin, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.email == creds.email).first()
    if not merchant or not verify_password(creds.password, merchant.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": merchant.email, "merchant_id": merchant.id})
    return {"access_token": token, "token_type": "bearer", "merchant": MerchantResponse.from_orm(merchant)}

@app.get("/api/auth/me", response_model=MerchantResponse)
def get_me(current: Merchant = Depends(get_current_merchant)):
    return current

# ─── Transaction Routes ──────────────────────────────────────────────────────
@app.get("/api/transactions", response_model=List[TransactionResponse])
def get_transactions(
    status: Optional[str] = None,
    limit: int = 50,
    current: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction).filter(Transaction.merchant_id == current.id)
    if status:
        query = query.filter(Transaction.status == status)
    return query.order_by(Transaction.created_at.desc()).limit(limit).all()

@app.get("/api/transactions/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    current: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    txn = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.merchant_id == current.id
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn

# ─── Razorpay Webhook ────────────────────────────────────────────────────────
@app.post("/api/webhooks/razorpay/{merchant_id}")
async def razorpay_webhook(merchant_id: int, request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Handle Razorpay payment webhooks for specific merchants (Platform-Partner Model)"""
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    webhook_secret = merchant.razorpay_webhook_secret or RAZORPAY_WEBHOOK_SECRET

    import razorpay
    client = razorpay.Client(auth=("", ""))
    try:
        client.utility.verify_webhook_signature(body.decode("utf-8"), signature, webhook_secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        data = await request.json()

    event = data.get("event", "")
    payload = data.get("payload", {}).get("payment", {}).get("entity", {})

    if event in ["payment.captured", "payment.authorized"]:
        razorpay_id = payload.get("id")
        order_id = payload.get("order_id")
        amount = payload.get("amount", 0) / 100
        contact = payload.get("contact")
        email = payload.get("email")
        description = payload.get("description", "UPI Payment")
        status = "captured" if event == "payment.captured" else "authorized"

        txn = None
        if order_id:
            txn = db.query(Transaction).filter(Transaction.razorpay_order_id == order_id).first()
            
        if not txn and razorpay_id:
            txn = db.query(Transaction).filter(Transaction.razorpay_payment_id == razorpay_id).first()

        if txn:
            txn.status = status
            txn.razorpay_payment_id = razorpay_id
            txn.updated_at = datetime.utcnow()
        else:
            # STATIC QR PAYMENT: Transaction doesn't exist in our DB yet!
            utr = generate_utr()
            txn = Transaction(
                merchant_id=merchant.id,
                amount=amount,
                utr=utr,
                status=status,
                razorpay_payment_id=razorpay_id,
                razorpay_order_id=order_id,
                customer_phone=contact,
                customer_email=email,
                description=f"Static QR Payment"
            )
            db.add(txn)

        if not txn.proof_hash and status == "captured":
            timestamp = datetime.utcnow().isoformat()
            txn.proof_hash = generate_proof_hash(txn.utr, amount, timestamp)

        db.commit()
        db.refresh(txn)

        # Send automated SMS to both parties
        if status == "captured":
            base_url = "https://settleproof.com"
            verify_url = f"{base_url}/v/{txn.utr}"
            if txn.customer_phone:
                cust_msg = f"Your payment of Rs.{txn.amount:.2f} to {merchant.business_name} is confirmed. Verify: {verify_url}"
                background_tasks.add_task(send_sms, txn.customer_phone, cust_msg)
            if merchant.phone:
                merch_msg = f"PaySure Alert: You received Rs.{txn.amount:.2f} from {txn.customer_phone or 'Customer'}. UTR: {txn.utr}. Verify: {verify_url}"
                background_tasks.add_task(send_sms, merchant.phone, merch_msg)

        return {"status": "success", "transaction_id": txn.id, "utr": txn.utr}

    elif event == "payment.failed":
        razorpay_id = payload.get("id")
        order_id = payload.get("order_id")
        txn = db.query(Transaction).filter(Transaction.razorpay_order_id == order_id).first()
        if txn:
            txn.status = "failed"
            txn.razorpay_payment_id = razorpay_id
            txn.updated_at = datetime.utcnow()
            db.commit()
        return {"status": "failed_recorded"}

    return {"status": "ignored", "event": event}

# ─── Proof & Verification ────────────────────────────────────────────────────
@app.post("/api/proof/generate")
def generate_proof(
    req: ProofRequest,
    current: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Generate and send payment proof to customer"""
    txn = db.query(Transaction).filter(
        Transaction.id == req.transaction_id,
        Transaction.merchant_id == current.id
    ).first()

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Generate verification URL
    base_url = "https://settleproof.com"  # Your domain
    verify_url = f"{base_url}/v/{txn.utr}"

    # Send SMS if phone provided
    phone = req.customer_phone or txn.customer_phone
    if phone:
        message = f"Your payment of ₹{txn.amount:.2f} to {current.business_name} is confirmed. Verify: {verify_url}"
        sms_result = send_sms(phone, message)
    else:
        sms_result = {"success": False, "error": "No phone number"}

    return {
        "transaction_id": txn.id,
        "utr": txn.utr,
        "verification_url": verify_url,
        "proof_hash": txn.proof_hash,
        "sms_sent": sms_result.get("success", False),
        "sms_details": sms_result
    }

@app.get("/api/verify/{utr}")
def verify_payment(utr: str, db: Session = Depends(get_db)):
    """Public endpoint for customer to verify payment"""
    txn = db.query(Transaction).filter(Transaction.utr == utr).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Payment not found")

    merchant = db.query(Merchant).filter(Merchant.id == txn.merchant_id).first()

    # Verify hash
    timestamp = txn.created_at.isoformat()
    expected_hash = generate_proof_hash(txn.utr, txn.amount, timestamp)
    is_valid = hmac.compare_digest(expected_hash, txn.proof_hash or "")

    return {
        "valid": is_valid,
        "amount": txn.amount,
        "currency": txn.currency,
        "utr": txn.utr,
        "status": txn.status,
        "merchant_name": merchant.business_name if merchant else "Unknown",
        "timestamp": txn.created_at,
        "description": txn.description,
        "refund_id": txn.refund_id,
        "refund_amount": txn.refund_amount
    }

# ─── Refund ──────────────────────────────────────────────────────────────────
@app.post("/api/refund")
async def process_refund(
    req: RefundRequest,
    background_tasks: BackgroundTasks,
    current: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Process refund with proof generation"""
    txn = db.query(Transaction).filter(
        Transaction.id == req.transaction_id,
        Transaction.merchant_id == current.id
    ).first()

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.status != "captured":
        raise HTTPException(status_code=400, detail="Can only refund captured payments")

    refund_amount = req.amount or txn.amount

    if razorpay_client:
        try:
            # Call Razorpay refund API
            refund_data = {
                "amount": int(refund_amount * 100),
                "notes": {"reason": req.reason}
            }
            refund_res = razorpay_client.payment.refund(txn.razorpay_payment_id, refund_data)
            refund_id = refund_res.get("id")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Refund failed: {str(e)}")
    else:
        # Simulated refund ID when Razorpay is not configured
        refund_id = f"rfnd_sim_{generate_utr()}"

    # Update transaction
    txn.status = "refunded"
    txn.refund_id = refund_id
    txn.refund_amount = refund_amount
    txn.refund_reason = req.reason
    txn.updated_at = datetime.utcnow()
    db.commit()

    # Generate refund proof URL
    base_url = "https://settleproof.com"
    refund_url = f"{base_url}/r/{refund_id}"

    # Notify customer
    if txn.customer_phone:
        message = f"Refund of ₹{refund_amount:.2f} from {current.business_name} processed. Track: {refund_url}"
        send_sms(txn.customer_phone, message)

    return {
        "success": True,
        "refund_id": refund_id,
        "amount": refund_amount,
        "reason": req.reason,
        "refund_url": refund_url,
        "transaction_id": txn.id
    }

@app.get("/api/refund/{refund_id}")
def get_refund(refund_id: str, db: Session = Depends(get_db)):
    """Public endpoint to verify refund"""
    txn = db.query(Transaction).filter(Transaction.refund_id == refund_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Refund not found")

    merchant = db.query(Merchant).filter(Merchant.id == txn.merchant_id).first()

    return {
        "refund_id": refund_id,
        "amount": txn.refund_amount,
        "original_amount": txn.amount,
        "reason": txn.refund_reason,
        "status": txn.status,
        "merchant_name": merchant.business_name if merchant else "Unknown",
        "timestamp": txn.updated_at,
        "original_utr": txn.utr
    }

# ─── AI Insights ─────────────────────────────────────────────────────────────
@app.get("/api/insights/daily")
async def get_daily_insights(
    current: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Get AI-generated daily summary"""
    summary = await generate_ai_summary(current.id, db)
    return {
        "merchant_id": current.id,
        "date": datetime.utcnow().date().isoformat(),
        "summary": summary,
        "generated_at": datetime.utcnow().isoformat()
    }

# ─── SMS Test ────────────────────────────────────────────────────────────────
@app.post("/api/sms/send")
def send_test_sms(req: SMSSendRequest, current: Merchant = Depends(get_current_merchant)):
    """Test SMS sending"""
    result = send_sms(req.phone, req.message)
    return result

# ─── Simulate Webhook (Hackathon Demo) ───────────────────────────────────────
@app.post("/api/test/simulate-webhook")
async def simulate_webhook(background_tasks: BackgroundTasks, current: Merchant = Depends(get_current_merchant), db: Session = Depends(get_db)):
    """Simulates Razorpay sending a webhook for a Static QR payment"""
    # 1. Generate fake payment data
    amount = float(random.choice([150, 450, 1299, 240, 50, 999]))
    razorpay_payment_id = f"pay_{''.join(random.choices(string.ascii_letters + string.digits, k=14))}"
    utr = generate_utr()
    timestamp = datetime.utcnow().isoformat()
    proof_hash = generate_proof_hash(utr, amount, timestamp)

    # 2. Directly log it into the database just like the webhook observer does
    txn = Transaction(
        merchant_id=current.id,
        amount=amount,
        utr=utr,
        razorpay_payment_id=razorpay_payment_id,
        status="captured",
        customer_phone="+919876543210",
        description="Static QR UPI Payment (Simulated)",
        proof_hash=proof_hash
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    # 3. Send SMS notifications
    base_url = "https://settleproof.com"
    verify_url = f"{base_url}/v/{txn.utr}"
    
    if txn.customer_phone:
        cust_msg = f"Your payment of Rs.{txn.amount:.2f} to {current.business_name} is confirmed. Verify: {verify_url}"
        background_tasks.add_task(send_sms, txn.customer_phone, cust_msg)
        
    if current.phone:
        merch_msg = f"PaySure Alert: You received Rs.{txn.amount:.2f} from {txn.customer_phone or 'Customer'}. UTR: {txn.utr}. Verify: {verify_url}"
        background_tasks.add_task(send_sms, current.phone, merch_msg)

    return {"success": True, "message": "Simulated Webhook Received", "transaction": TransactionResponse.from_orm(txn)}

# ─── Health Check ────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "paysure",
        "version": "1.0.0",
        "groq_configured": groq_client is not None,
        "razorpay_configured": razorpay_client is not None
    }

# ─── Razorpay Payment Creation ────────────────────────────────────────
@app.post("/api/payments/create-order")
def create_order(
    req: CreateOrderRequest,
    current: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Create a real order in Razorpay"""
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Razorpay not configured")

    amount_in_paise = int(req.amount * 100)
    
    order_data = {
        "amount": amount_in_paise,
        "currency": "INR",
        "receipt": f"receipt_{current.id}_{int(datetime.utcnow().timestamp())}",
        "notes": {
            "description": req.description
        }
    }
    
    try:
        if current.razorpay_key_id and current.razorpay_key_secret:
            merchant_client = razorpay.Client(auth=(current.razorpay_key_id, current.razorpay_key_secret))
            razorpay_order = merchant_client.order.create(data=order_data)
        else:
            razorpay_order = razorpay_client.order.create(data=order_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    utr = generate_utr()
    
    txn = Transaction(
        merchant_id=current.id,
        amount=req.amount,
        utr=utr,
        status="pending",
        razorpay_order_id=razorpay_order["id"],
        customer_phone=req.customer_phone,
        customer_email=req.customer_email,
        description=req.description
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    return {
        "success": True,
        "transaction": TransactionResponse.from_orm(txn),
        "razorpay_order_id": razorpay_order["id"],
        "key_id": current.razorpay_key_id or RAZORPAY_KEY_ID
    }

@app.post("/api/payments/confirm")
def confirm_payment(req: PaymentConfirmRequest, background_tasks: BackgroundTasks, current: Merchant = Depends(get_current_merchant), db: Session = Depends(get_db)):
    """Confirm a successful checkout payment and send SMS notifications to both parties"""
    txn = db.query(Transaction).filter(Transaction.id == req.transaction_id, Transaction.merchant_id == current.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    if txn.status != "captured":
        txn.status = "captured"
        txn.razorpay_payment_id = req.razorpay_payment_id
        txn.updated_at = datetime.utcnow()
        if not txn.proof_hash:
            timestamp = datetime.utcnow().isoformat()
            txn.proof_hash = generate_proof_hash(txn.utr, txn.amount, timestamp)
        db.commit()
        db.refresh(txn)
        
        # Send SMS
        base_url = "https://settleproof.com"
        verify_url = f"{base_url}/v/{txn.utr}"
        if txn.customer_phone:
            cust_msg = f"Your payment of Rs.{txn.amount:.2f} to {current.business_name} is confirmed. Verify: {verify_url}"
            background_tasks.add_task(send_sms, txn.customer_phone, cust_msg)
            
        if current.phone:
            merch_msg = f"PaySure Alert: You received Rs.{txn.amount:.2f} from {txn.customer_phone or 'Customer'}. UTR: {txn.utr}. Verify: {verify_url}"
            background_tasks.add_task(send_sms, current.phone, merch_msg)

    return {"success": True}

# ─── Main ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
