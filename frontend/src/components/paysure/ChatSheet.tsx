import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Loader2 } from "lucide-react";
import type { Transaction } from "@/data/transactions";

interface Msg {
  id: string;
  from: "me" | "bot";
  text: string;
}

const initial: Msg[] = [
  { id: "1", from: "bot", text: "Hi! I'm PaySure Help — powered by Gemini AI. Ask me about your payments, disputed transactions, or refund advice." },
];

const QUICK = [
  "Which transactions are disputed?",
  "Any duplicates to refund?",
  "Summarize today's activity",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
}

export const ChatSheet = ({ open, onOpenChange, transactions }: Props) => {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const id = Date.now().toString();
    const userMsg: Msg = { id, from: "me", text };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      await new Promise((res) => setTimeout(res, 1500));
      let reply = "This is a simulated AI response. Since the backend is disabled, I cannot analyze your transactions in real-time.";
      
      if (text.toLowerCase().includes("dispute")) {
        reply = "You have a few disputed transactions. I recommend checking the 'Duplicates' tab and refunding the second transaction if the UTRs match.";
      } else if (text.toLowerCase().includes("refund")) {
        reply = "To refund a transaction, tap on it in the log and click the 'Refund to Customer' button. This will simulate a refund locally.";
      } else if (text.toLowerCase().includes("summarize") || text.toLowerCase().includes("today")) {
        reply = `You have ${transactions.filter(t => t.date === "Today").length} transactions recorded for today. Everything looks normal!`;
      }
      
      setMsgs((m) => [...m, { id: id + "b", from: "bot", text: reply }]);
    } catch {
      setMsgs((m) => [
        ...m,
        { id: id + "b", from: "bot", text: "Sorry, I couldn't process that locally." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-6 pb-4 text-left border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            PaySure Help
          </SheetTitle>
          <p className="text-xs text-muted-foreground font-normal">AI-powered insights about your payments</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/30">
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
                  m.from === "me"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Analyzing transactions…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="px-4 pt-2 pb-1 border-t border-border bg-background">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex gap-2 pb-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your transactions…"
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" size="icon" className="shrink-0" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};
