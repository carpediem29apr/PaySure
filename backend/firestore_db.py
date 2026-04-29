"""
PaySure — Firestore Database Module
Wraps all Firebase Firestore operations for merchants and transactions.
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone

# ─── Firebase Initialization ─────────────────────────────────────────────────

db = None

def init_firebase():
    """Initialize Firebase Admin SDK and return Firestore client."""
    global db
    if db is not None:
        return db

    # Try local JSON file first, then env var for Render/production
    cred_path = os.path.join(os.path.dirname(__file__), "firebase-service-account.json")
    
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    elif os.getenv("FIREBASE_CREDENTIALS_JSON"):
        import json
        cred_dict = json.loads(os.getenv("FIREBASE_CREDENTIALS_JSON"))
        cred = credentials.Certificate(cred_dict)
    else:
        raise RuntimeError("No Firebase credentials found. Place firebase-service-account.json in backend/ or set FIREBASE_CREDENTIALS_JSON env var.")

    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print(f"✅ Firebase initialized — project: {cred.project_id}")
    return db

def get_db():
    """Get the Firestore client (initialize if needed)."""
    global db
    if db is None:
        init_firebase()
    return db

# ─── Merchant Operations ─────────────────────────────────────────────────────

def create_merchant(data: dict) -> dict:
    """Create a merchant document. Returns the merchant dict with 'id' field."""
    doc_ref = get_db().collection("merchants").document()
    data["created_at"] = datetime.utcnow()
    data["is_active"] = True
    doc_ref.set(data)
    return {**data, "id": doc_ref.id}

def get_merchant_by_email(email: str) -> dict | None:
    """Query merchant by email."""
    docs = get_db().collection("merchants").where("email", "==", email).limit(1).stream()
    for doc in docs:
        return {**doc.to_dict(), "id": doc.id}
    return None

def get_merchant_by_phone(phone: str) -> dict | None:
    """Query merchant by phone number."""
    docs = get_db().collection("merchants").where("phone", "==", phone).limit(1).stream()
    for doc in docs:
        return {**doc.to_dict(), "id": doc.id}
    return None

def get_merchant_by_id(merchant_id: str) -> dict | None:
    """Get merchant by document ID."""
    doc = get_db().collection("merchants").document(merchant_id).get()
    if doc.exists:
        return {**doc.to_dict(), "id": doc.id}
    return None

def get_first_merchant() -> dict | None:
    """Get the first merchant (for demo/no-auth mode)."""
    docs = get_db().collection("merchants").limit(1).stream()
    for doc in docs:
        return {**doc.to_dict(), "id": doc.id}
    return None

# ─── Transaction Operations ──────────────────────────────────────────────────

def create_transaction(data: dict) -> dict:
    """Create a transaction document. Returns the transaction dict with 'id' field."""
    doc_ref = get_db().collection("transactions").document()
    data["created_at"] = datetime.utcnow()
    data["updated_at"] = datetime.utcnow()
    # Ensure defaults
    data.setdefault("currency", "INR")
    data.setdefault("status", "pending")
    doc_ref.set(data)
    return {**data, "id": doc_ref.id}

def get_transaction(txn_id: str, merchant_id: str = None) -> dict | None:
    """Get a single transaction by ID, optionally filtered by merchant."""
    doc = get_db().collection("transactions").document(txn_id).get()
    if not doc.exists:
        return None
    txn = {**doc.to_dict(), "id": doc.id}
    if merchant_id and txn.get("merchant_id") != merchant_id:
        return None
    return txn

def get_transactions(merchant_id: str, status: str = None, limit: int = 50) -> list:
    """List transactions for a merchant, optionally filtered by status."""
    query = get_db().collection("transactions").where("merchant_id", "==", merchant_id)
    if status:
        query = query.where("status", "==", status)
    results = [{**doc.to_dict(), "id": doc.id} for doc in query.stream()]
    results.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
    return results[:limit]

def get_transaction_by_utr(utr: str) -> dict | None:
    """Query transaction by UTR."""
    docs = get_db().collection("transactions").where("utr", "==", utr).limit(1).stream()
    for doc in docs:
        return {**doc.to_dict(), "id": doc.id}
    return None

def get_transaction_by_order_id(order_id: str) -> dict | None:
    """Query transaction by Razorpay order ID."""
    docs = get_db().collection("transactions").where("razorpay_order_id", "==", order_id).limit(1).stream()
    for doc in docs:
        return {**doc.to_dict(), "id": doc.id}
    return None

def get_transaction_by_payment_id(payment_id: str) -> dict | None:
    """Query transaction by Razorpay payment ID."""
    docs = get_db().collection("transactions").where("razorpay_payment_id", "==", payment_id).limit(1).stream()
    for doc in docs:
        return {**doc.to_dict(), "id": doc.id}
    return None

def get_transaction_by_refund_id(refund_id: str) -> dict | None:
    """Query transaction by refund ID."""
    docs = get_db().collection("transactions").where("refund_id", "==", refund_id).limit(1).stream()
    for doc in docs:
        return {**doc.to_dict(), "id": doc.id}
    return None

def update_transaction(txn_id: str, data: dict) -> dict:
    """Partial update a transaction document."""
    data["updated_at"] = datetime.utcnow()
    get_db().collection("transactions").document(txn_id).update(data)
    return get_transaction(txn_id)

def get_daily_transactions(merchant_id: str) -> list:
    """Get today's transactions for a merchant."""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    query = (
        get_db().collection("transactions")
        .where("merchant_id", "==", merchant_id)
        .where("created_at", ">=", today)
    )
    return [{**doc.to_dict(), "id": doc.id} for doc in query.stream()]
