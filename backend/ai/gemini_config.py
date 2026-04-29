"""
PaySure AI — Groq Configuration & System Prompts
Centralized AI logic for transaction insights and merchant chat.
"""

# ─── System Prompt for PaySure Help Chat ─────────────────────────────────────

PAYSURE_SYSTEM_PROMPT = """You are **PaySure Help**, an AI assistant for Indian UPI merchants. You help small business owners understand their payment transactions, resolve disputes, and manage refunds.

## Your Personality
- Friendly, concise, and practical — like a knowledgeable accountant friend
- Always respond in short, actionable sentences
- Use ₹ symbol for amounts, and Indian English style
- If you don't know something, say so clearly

## Your Capabilities
You have access to the merchant's real transaction data. Use it to:
1. **Identify disputed transactions** — duplicates, stuck "verifying" payments
2. **Recommend actions** — when to refund, when to wait, when to contact the bank
3. **Explain statuses** — what "verifying" means, why duplicates happen
4. **Summarize daily activity** — total received, pending, refunded amounts
5. **Answer general UPI/payment questions**

## Transaction Status Guide
- **verifying**: Bank hasn't confirmed yet. Usually clears in 3–60 seconds. If stuck >5 mins, likely a bank-side delay.
- **duplicate**: Same customer paid twice within 60 seconds for the same amount. Merchant should refund one.
- **refunded**: Money returned to the customer's account instantly via UPI.
- **received/captured**: Payment confirmed and settled.

## Rules
- Never make up transaction data. Only reference transactions provided in context.
- If asked about a specific customer, search the transactions by name.
- Keep responses under 150 words unless the user asks for a detailed breakdown.
- When recommending a refund, mention the exact amount and customer name.
"""

# ─── Prompt Builder ──────────────────────────────────────────────────────────

def build_chat_prompt(transactions: list, user_message: str, history: list = None) -> list:
    """
    Build the message list for Groq chat completions, injecting transaction context.
    
    Args:
        transactions: List of transaction dicts from the frontend
        user_message: The merchant's current question
        history: Previous chat messages [{role, text}]
    
    Returns:
        List of message dicts for Groq API (OpenAI-compatible format)
    """
    # Format transaction data as a readable table
    txn_summary = format_transactions(transactions) if transactions else "No transaction data available."
    
    # Build the context-enriched system message
    system_content = f"""{PAYSURE_SYSTEM_PROMPT}

## Current Transaction Data
{txn_summary}
"""
    
    messages = []
    
    # System message (Groq/OpenAI supports a proper system role)
    messages.append({
        "role": "system",
        "content": system_content
    })
    
    # Add conversation history
    if history:
        for msg in history:
            role = "user" if msg.get("from") == "me" else "assistant"
            messages.append({
                "role": role,
                "content": msg.get("text", "")
            })
    
    # Add the current user message
    messages.append({
        "role": "user",
        "content": user_message
    })
    
    return messages


def format_transactions(transactions: list) -> str:
    """Format transaction list into a readable summary for the AI."""
    if not transactions:
        return "No transactions available."
    
    lines = []
    lines.append("| # | Customer | Amount | Status | Type | Time | UTR |")
    lines.append("|---|----------|--------|--------|------|------|-----|")
    
    for i, txn in enumerate(transactions, 1):
        name = txn.get("customerName", "Unknown")
        amount = txn.get("amount", 0)
        status = txn.get("status", "unknown")
        txn_type = txn.get("type", "standard")
        time = f"{txn.get('date', '')} {txn.get('time', '')}"
        utr = txn.get("utr", "—")
        
        lines.append(f"| {i} | {name} | ₹{amount} | {status} | {txn_type} | {time} | {utr} |")
    
    # Add summary stats
    total = sum(t.get("amount", 0) for t in transactions)
    verifying = sum(1 for t in transactions if t.get("status") == "verifying")
    duplicates = sum(1 for t in transactions if t.get("status") == "duplicate")
    refunded = sum(1 for t in transactions if t.get("status") == "refunded")
    
    lines.append(f"\n**Summary:** {len(transactions)} transactions | Total: ₹{total:,.0f} | Verifying: {verifying} | Duplicates: {duplicates} | Refunded: {refunded}")
    
    return "\n".join(lines)


# ─── Prompt for Daily Insights ───────────────────────────────────────────────

DAILY_INSIGHTS_PROMPT = """Analyze this merchant's daily transaction data and provide a brief, actionable summary in 2-3 sentences.

Focus on:
- Any concerning patterns (multiple duplicates, many verifying transactions)
- Actionable recommendations (refund duplicates, contact bank for stuck payments)
- A positive note about business activity

Keep it concise, friendly, and practical. Use ₹ for amounts."""
