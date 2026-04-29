import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles } from "lucide-react";

interface Msg {
  id: string;
  from: "me" | "bot";
  text: string;
}

const initial: Msg[] = [
  { id: "1", from: "bot", text: "Hi! I'm PaySure Help. Ask me about payments, refunds or settlements." },
];

const QUICK = [
  "How do refunds work?",
  "Today's settlement?",
  "Why is a payment verifying?",
];

const reply = (q: string) => {
  const t = q.toLowerCase();
  if (t.includes("refund")) return "Tap any duplicate transaction → 'Refund Duplicate Payment'. Money returns instantly via UPI.";
  if (t.includes("settle")) return "Today's settlement so far: ₹12,480. It credits to your bank by 10 PM.";
  if (t.includes("verify") || t.includes("verifying")) return "A payment shows VERIFYING when the bank hasn't sent us a final confirmation. Usually clears in 3 seconds.";
  return "Got it. A teammate will guide you. Meanwhile, you can check transaction details from the home screen.";
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChatSheet = ({ open, onOpenChange }: Props) => {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const id = Date.now().toString();
    setMsgs((m) => [...m, { id, from: "me", text }]);
    setInput("");
    setTimeout(() => {
      setMsgs((m) => [...m, { id: id + "b", from: "bot", text: reply(text) }]);
    }, 450);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-6 pb-4 text-left border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            PaySure Help
          </SheetTitle>
          <p className="text-xs text-muted-foreground font-normal">Ask anything about your payments</p>
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
          <div ref={endRef} />
        </div>

        <div className="px-4 pt-2 pb-1 border-t border-border bg-background">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent transition-colors"
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
              placeholder="Type your question…"
              className="flex-1"
            />
            <Button type="submit" size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};
