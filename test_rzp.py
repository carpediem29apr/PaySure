import urllib.request
import json
data = json.dumps({'amount': 100}).encode()
req = urllib.request.Request('http://localhost:8000/api/payments/create-order', data=data, headers={'Content-Type': 'application/json'})
res = urllib.request.urlopen(req)
response = json.loads(res.read().decode())
print("ORDER:", response)

html_content = f"""
<!DOCTYPE html>
<html>
<head><title>Test Razorpay</title></head>
<body>
<button id="rzp-button1">Pay</button>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var options = {{
    "key": "{response['key_id']}",
    "amount": "{int(response['transaction']['amount'] * 100)}",
    "currency": "INR",
    "name": "PaySure",
    "description": "Payment for order",
    "order_id": "{response['razorpay_order_id']}",
    "handler": function (response){{
        alert(response.razorpay_payment_id);
    }},
    "prefill": {{
        "contact": "+919876543210"
    }},
    "theme": {{
        "color": "#000000"
    }}
}};
var rzp1 = new Razorpay(options);
rzp1.on('payment.failed', function (response){{
        alert(response.error.description);
}});
document.getElementById('rzp-button1').onclick = function(e){{
    rzp1.open();
    e.preventDefault();
}}
</script>
</body>
</html>
"""

with open("test_rzp.html", "w") as f:
    f.write(html_content)
