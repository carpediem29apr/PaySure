import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.paysure.app',
  appName: 'PaySure',
  webDir: 'dist',
  server: {
    allowNavigation: [
      "api.razorpay.com",
      "checkout.razorpay.com",
      "razorpay.com",
      "*"
    ],
    appendUserAgent: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
  }
};

export default config;
