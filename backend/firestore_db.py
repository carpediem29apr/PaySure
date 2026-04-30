"""
PaySure — SQLite Database Module
Replacing Firestore to use a persistent SQLite database so payments and QR codes work seamlessly.
"""

import sqlite3
import os
from datetime import datetime
import json
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), "paysure.db")

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = dict_factory
    return conn

def init_firebase():
    """Dummy initialization for backward compatibility."""
    print("✅ Using SQLite Persistent Database instead of Firebase!")
    return get_db()

# ─── Merchant Operations ─────────────────────────────────────────────────────

def create_merchant(data: dict) -> dict:
    conn = get_db()
    data["created_at"] = datetime.utcnow().isoformat()
    data["is_active"] = True
    
    # If no ID provided, sqlite will auto-increment, but we need strings for Firebase compatibility
    # Let's just let SQLite use integer IDs but convert to string
    cols = ", ".join(data.keys())
    placeholders = ", ".join("?" for _ in data)
    
    cur = conn.cursor()
    cur.execute(f"INSERT INTO merchants ({cols}) VALUES ({placeholders})", tuple(data.values()))
    conn.commit()
    merchant_id = str(cur.lastrowid)
    return {**data, "id": merchant_id}

def get_merchant_by_email(email: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM merchants WHERE email = ? LIMIT 1", (email,)).fetchone()
    if row: row["id"] = str(row["id"])
    return row

def get_merchant_by_id(merchant_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM merchants WHERE id = ? LIMIT 1", (merchant_id,)).fetchone()
    if row: row["id"] = str(row["id"])
    return row

def get_first_merchant() -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM merchants LIMIT 1").fetchone()
    if row: row["id"] = str(row["id"])
    return row

# ─── Transaction Operations ──────────────────────────────────────────────────

def create_transaction(data: dict) -> dict:
    conn = get_db()
    data["created_at"] = datetime.utcnow().isoformat()
    data["updated_at"] = datetime.utcnow().isoformat()
    data.setdefault("currency", "INR")
    data.setdefault("status", "pending")
    
    cols = ", ".join(data.keys())
    placeholders = ", ".join("?" for _ in data)
    
    cur = conn.cursor()
    cur.execute(f"INSERT INTO transactions ({cols}) VALUES ({placeholders})", tuple(data.values()))
    conn.commit()
    txn_id = str(cur.lastrowid)
    return {**data, "id": txn_id}

def get_transaction(txn_id: str, merchant_id: str = None) -> dict | None:
    conn = get_db()
    if merchant_id:
        row = conn.execute("SELECT * FROM transactions WHERE id = ? AND merchant_id = ?", (txn_id, merchant_id)).fetchone()
    else:
        row = conn.execute("SELECT * FROM transactions WHERE id = ?", (txn_id,)).fetchone()
    if row: row["id"] = str(row["id"])
    return row

def get_transactions(merchant_id: str, status: str = None, limit: int = 50) -> list:
    conn = get_db()
    if status:
        rows = conn.execute("SELECT * FROM transactions WHERE merchant_id = ? AND status = ? ORDER BY id DESC LIMIT ?", (merchant_id, status, limit)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM transactions WHERE merchant_id = ? ORDER BY id DESC LIMIT ?", (merchant_id, limit)).fetchall()
    
    for r in rows: r["id"] = str(r["id"])
    return rows

def get_transaction_by_utr(utr: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM transactions WHERE utr = ? LIMIT 1", (utr,)).fetchone()
    if row: row["id"] = str(row["id"])
    return row

def get_transaction_by_order_id(order_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM transactions WHERE razorpay_order_id = ? LIMIT 1", (order_id,)).fetchone()
    if row: row["id"] = str(row["id"])
    return row

def get_transaction_by_payment_id(payment_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM transactions WHERE razorpay_payment_id = ? LIMIT 1", (payment_id,)).fetchone()
    if row: row["id"] = str(row["id"])
    return row

def get_transaction_by_refund_id(refund_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM transactions WHERE refund_id = ? LIMIT 1", (refund_id,)).fetchone()
    if row: row["id"] = str(row["id"])
    return row

def update_transaction(txn_id: str, data: dict) -> dict:
    conn = get_db()
    data["updated_at"] = datetime.utcnow().isoformat()
    
    set_clause = ", ".join(f"{k} = ?" for k in data.keys())
    values = tuple(data.values()) + (txn_id,)
    
    conn.execute(f"UPDATE transactions SET {set_clause} WHERE id = ?", values)
    conn.commit()
    return get_transaction(txn_id)

def get_daily_transactions(merchant_id: str) -> list:
    conn = get_db()
    today_prefix = datetime.utcnow().strftime("%Y-%m-%d")
    rows = conn.execute("SELECT * FROM transactions WHERE merchant_id = ? AND created_at LIKE ? ORDER BY id DESC", (merchant_id, f"{today_prefix}%")).fetchall()
    for r in rows: r["id"] = str(r["id"])
    return rows
