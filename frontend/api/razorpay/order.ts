import https from 'https';
import { VercelRequest, VercelResponse } from '@vercel/node';

const RAZORPAY_KEY_ID = 'rzp_test_SjPsXMmj345aei';
const RAZORPAY_KEY_SECRET = '5V769lVZJTc4iuZO44PLldBM';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const amount = req.body?.amount || 100;
  
  const postData = JSON.stringify({
    amount: amount * 100, // amount in paise
    currency: "INR",
    receipt: `receipt_${Date.now()}`,
  });

  const options = {
    hostname: 'api.razorpay.com',
    port: 443,
    path: '/v1/orders',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let proxyBody = '';
    proxyRes.on('data', (chunk) => proxyBody += chunk);
    proxyRes.on('end', () => {
      res.status(proxyRes.statusCode || 200).send(proxyBody);
    });
  });

  proxyReq.on('error', (e) => {
    res.status(500).json({ error: e.message });
  });

  proxyReq.write(postData);
  proxyReq.end();
}
