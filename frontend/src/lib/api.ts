/**
 * PaySure API Client
 * Central API helpers for communicating with the backend.
 */

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
