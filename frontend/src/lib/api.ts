/**
 * PaySure API Client
 * Central API helpers for communicating with the backend.
 */

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Backend Warm-Up (Render free tier goes to sleep after 15 min) ─────────
let _backendReady = false;
let _warmUpPromise: Promise<boolean> | null = null;

export function warmUpBackend(): Promise<boolean> {
  if (_backendReady) return Promise.resolve(true);
  if (_warmUpPromise) return _warmUpPromise;
  _warmUpPromise = fetch(`${API_BASE}/api/health`, { mode: "cors" })
    .then((r) => { _backendReady = r.ok; return r.ok; })
    .catch(() => { _backendReady = false; return false; });
  return _warmUpPromise;
}

// Fire warm-up immediately when this module is imported
warmUpBackend();

// ─── Razorpay Script Preloader ────────────────────────────────────────────
let _razorpayLoaded = false;
let _razorpayPromise: Promise<boolean> | null = null;

export function preloadRazorpay(): Promise<boolean> {
  if (_razorpayLoaded && (window as any).Razorpay) return Promise.resolve(true);
  if (_razorpayPromise) return _razorpayPromise;
  _razorpayPromise = new Promise<boolean>((resolve) => {
    // Check if already loaded
    if ((window as any).Razorpay) { _razorpayLoaded = true; resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => { _razorpayLoaded = true; resolve(true); };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return _razorpayPromise;
}

// Pre-load Razorpay SDK immediately
preloadRazorpay();

export function isBackendReady(): boolean { return _backendReady; }

interface ChatMessage {
  id: string;
  from: "me" | "bot";
  text: string;
}

interface TransactionContext {
  id: string;
  type: string;
  amount: number;
  status: string;
  date: string;
  time: string;
  customerName?: string;
  upiLast4?: string;
  utr: string;
  utrDuplicate?: string;
  paymentMethod: string;
  refundedAt?: string;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  transactions: TransactionContext[]
): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.map((m) => ({ from: m.from, text: m.text })),
        transactions,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.reply;
  } catch (error) {
    console.error("Chat API error:", error);
    throw error;
  }
}

export async function checkHealth(): Promise<boolean> {
  return warmUpBackend();
}
