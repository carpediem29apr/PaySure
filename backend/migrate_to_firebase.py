"""Migrate existing SQLite data to Firebase Firestore."""
import sqlite3
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from firestore_db import init_firebase, get_db
from datetime import datetime

def migrate():
    init_firebase()
    db = get_db()
    
    sqlite_path = os.path.join(os.path.dirname(__file__), "paysure.db")
    if not os.path.exists(sqlite_path):
        # Try root level
        sqlite_path = os.path.join(os.path.dirname(__file__), "..", "paysure.db")
    
    if not os.path.exists(sqlite_path):
        print("No paysure.db found, skipping migration.")
        return
    
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Migrate merchants
    print("Migrating merchants...")
    cursor.execute("SELECT * FROM merchants")
    merchant_map = {}  # old_id -> new_firestore_id
    for row in cursor.fetchall():
        data = dict(row)
        old_id = data.pop("id")
        # Convert datetime strings
        if data.get("created_at"):
            try:
                data["created_at"] = datetime.fromisoformat(str(data["created_at"]))
            except:
                data["created_at"] = datetime.utcnow()
        else:
            data["created_at"] = datetime.utcnow()
        data["is_active"] = bool(data.get("is_active", True))
        
        # Check if already exists
        existing = list(db.collection("merchants").where("email", "==", data.get("email")).limit(1).stream())
        if existing:
            merchant_map[old_id] = existing[0].id
            print(f"  Merchant '{data.get('email')}' already exists, skipping.")
            continue
        
        doc_ref = db.collection("merchants").document()
        doc_ref.set(data)
        merchant_map[old_id] = doc_ref.id
        print(f"  ✅ Migrated merchant: {data.get('email')} -> {doc_ref.id}")
    
    # Migrate transactions
    print("\nMigrating transactions...")
    cursor.execute("SELECT * FROM transactions")
    for row in cursor.fetchall():
        data = dict(row)
        old_id = data.pop("id")
        old_merchant_id = data.pop("merchant_id", None)
        
        # Map old merchant_id to new Firestore ID
        data["merchant_id"] = merchant_map.get(old_merchant_id, str(old_merchant_id))
        
        for field in ["created_at", "updated_at"]:
            if data.get(field):
                try:
                    data[field] = datetime.fromisoformat(str(data[field]))
                except:
                    data[field] = datetime.utcnow()
            else:
                data[field] = datetime.utcnow()
        
        # Check if UTR already exists
        utr = data.get("utr")
        if utr:
            existing = list(db.collection("transactions").where("utr", "==", utr).limit(1).stream())
            if existing:
                print(f"  Transaction UTR {utr} already exists, skipping.")
                continue
        
        doc_ref = db.collection("transactions").document()
        doc_ref.set(data)
        print(f"  ✅ Migrated txn: {utr} (₹{data.get('amount', 0)}) -> {doc_ref.id}")
    
    conn.close()
    print("\n✅ Migration complete!")

if __name__ == "__main__":
    migrate()
