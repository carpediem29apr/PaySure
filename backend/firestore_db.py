"""
PaySure — MongoDB Database Module
Replaces SQLite/Firestore with MongoDB for real-time and robust persistent storage.
"""

import os
from datetime import datetime
from pymongo import MongoClient
from bson.objectid import ObjectId

client = None
db = None

def get_db():
    global client, db
    if db is None:
        # Fallback to localhost if not provided
        uri = os.getenv("MONGODB_URI", "mongodb+srv://admin:admin@cluster0.paysure.mongodb.net/?retryWrites=true&w=majority")
        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            client.server_info() # Trigger connection test
            db = client["paysure"]
            print("✅ Successfully connected to MongoDB!")
        except Exception as e:
            print(f"⚠️ MongoDB connection failed: {e}. Falling back to localhost.")
            client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
            db = client["paysure"]
    return db

def init_firebase():
    """Dummy initialization for backward compatibility with main.py"""
    return get_db()

def _serialize(doc: dict) -> dict | None:
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc

# ─── Merchant Operations ─────────────────────────────────────────────────────

def create_merchant(data: dict) -> dict:
    data["created_at"] = datetime.utcnow().isoformat()
    data["is_active"] = True
    result = get_db()["merchants"].insert_one(data)
    data["_id"] = result.inserted_id
    return _serialize(data)

def get_merchant_by_email(email: str) -> dict | None:
    return _serialize(get_db()["merchants"].find_one({"email": email}))

def get_merchant_by_phone(phone: str) -> dict | None:
    return _serialize(get_db()["merchants"].find_one({"phone": phone}))

def get_merchant_by_id(merchant_id: str) -> dict | None:
    try:
        return _serialize(get_db()["merchants"].find_one({"_id": ObjectId(merchant_id)}))
    except:
        return None

def get_first_merchant() -> dict | None:
    return _serialize(get_db()["merchants"].find_one())

# ─── Transaction Operations ──────────────────────────────────────────────────

def create_transaction(data: dict) -> dict:
    data["created_at"] = datetime.utcnow().isoformat()
    data["updated_at"] = datetime.utcnow().isoformat()
    data.setdefault("currency", "INR")
    data.setdefault("status", "pending")
    result = get_db()["transactions"].insert_one(data)
    data["_id"] = result.inserted_id
    return _serialize(data)

def get_transaction(txn_id: str, merchant_id: str = None) -> dict | None:
    try:
        query = {"_id": ObjectId(txn_id)}
        if merchant_id:
            query["merchant_id"] = merchant_id
        return _serialize(get_db()["transactions"].find_one(query))
    except:
        return None

def get_transactions(merchant_id: str, status: str = None, limit: int = 50) -> list:
    query = {"merchant_id": merchant_id}
    if status:
        query["status"] = status
    cursor = get_db()["transactions"].find(query).sort("created_at", -1).limit(limit)
    return [_serialize(doc) for doc in cursor]

def get_transaction_by_utr(utr: str) -> dict | None:
    return _serialize(get_db()["transactions"].find_one({"utr": utr}))

def get_transaction_by_order_id(order_id: str) -> dict | None:
    return _serialize(get_db()["transactions"].find_one({"razorpay_order_id": order_id}))

def get_transaction_by_payment_id(payment_id: str) -> dict | None:
    return _serialize(get_db()["transactions"].find_one({"razorpay_payment_id": payment_id}))

def get_transaction_by_refund_id(refund_id: str) -> dict | None:
    return _serialize(get_db()["transactions"].find_one({"refund_id": refund_id}))

def update_transaction(txn_id: str, data: dict) -> dict:
    try:
        data["updated_at"] = datetime.utcnow().isoformat()
        get_db()["transactions"].update_one(
            {"_id": ObjectId(txn_id)},
            {"$set": data}
        )
        return get_transaction(txn_id)
    except:
        return None

def get_daily_transactions(merchant_id: str) -> list:
    today_prefix = datetime.utcnow().strftime("%Y-%m-%d")
    query = {
        "merchant_id": merchant_id,
        "created_at": {"$regex": f"^{today_prefix}"}
    }
    cursor = get_db()["transactions"].find(query).sort("created_at", -1)
    return [_serialize(doc) for doc in cursor]
