import sqlite3
conn = sqlite3.connect('paysure.db')
conn.execute("UPDATE merchants SET razorpay_webhook_secret = 'aigk_3D2otCURGXKm5rHt2Prn1qzrCZG', razorpay_key_id = 'rzp_test_SjPsXMmj345aei', razorpay_key_secret = '5V769lVZJTc4iuZO44PLldBM'")
conn.commit()
conn.close()
