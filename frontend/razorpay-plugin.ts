import https from 'https';
import type { Plugin } from 'vite';

const RAZORPAY_KEY_ID = 'rzp_test_SjPsXMmj345aei';
const RAZORPAY_KEY_SECRET = '5V769lVZJTc4iuZO44PLldBM';

export function razorpayPlugin(): Plugin {
  return {
    name: 'razorpay-proxy',
    configureServer(server) {
      server.middlewares.use('/api/razorpay/order', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const amount = data.amount || 100;

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
                  res.setHeader('Content-Type', 'application/json');
                  res.end(proxyBody);
                });
              });

              proxyReq.on('error', (e) => {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              });

              proxyReq.write(postData);
              proxyReq.end();
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
      });
    }
  };
}
