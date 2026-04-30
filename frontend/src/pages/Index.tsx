import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/paysure/Header";
import { TransactionCard } from "@/components/paysure/TransactionCard";
import { TransactionDetail } from "@/components/paysure/TransactionDetail";
import { ProfileSheet } from "@/components/paysure/ProfileSheet";
import { ChatSheet } from "@/components/paysure/ChatSheet";
import { initialTransactions, type Transaction } from "@/data/transactions";
import { User, MessageCircle, Plus, BarChart3, Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const [txns, setTxns] = useState<Transaction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auth guard: redirect to login if not authenticated
  useEffect(() => {
    const currentUser = localStorage.getItem("paysure_current_user");
    if (!currentUser) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Load transactions from localStorage
  const loadTxns = useCallback(() => {
    try {
      const stored = localStorage.getItem("paysure_txns");
      if (stored) {
        setTxns(JSON.parse(stored));
      } else {
        localStorage.setItem("paysure_txns", JSON.stringify(initialTransactions));
        setTxns(initialTransactions);
      }
    } catch (err) {
      console.error("Failed to load transactions", err);
      setTxns(initialTransactions);
    }
  }, []);

  useEffect(() => {
    loadTxns();
  }, [loadTxns]);

  const preloadRazorpay = (): Promise<boolean> => {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).Razorpay) { resolve(true); return; }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  };

  const createPayment = async () => {
    const amountStr = window.prompt("Enter amount to charge (in ₹):", "100");
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return alert("Invalid amount");

    setLoading(true);
    try {
      // Fetch order ID securely using Vite proxy or Vercel live function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isCapacitor = !!(window as any).Capacitor;
      const apiUrl = isCapacitor 
        ? 'https://paysure-five.vercel.app/api/razorpay/order' 
        : '/api/razorpay/order';

      const orderRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      if (!orderRes.ok) throw new Error("Failed to create order");
      const orderData = await orderRes.json();

      const isReady = await preloadRazorpay();
      if (!isReady) {
        alert("Razorpay SDK failed to load. Please check your internet connection.");
        setLoading(false);
        return;
      }

      let currentTxnId = `txn_${Date.now()}`;
      
      // 1. Instantly log 'verifying' when initialized
      const initialTxn: Transaction = {
        id: currentTxnId,
        type: "standard",
        amount,
        status: "verifying",
        date: "Today",
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
        customerName: "Walk-in Customer",
        utr: `VERIFYING_${Math.floor(Math.random() * 1000000)}`,
        paymentMethod: "UPI — Razorpay"
      };

      setTxns(prev => {
        const updated = [initialTxn, ...prev];
        localStorage.setItem("paysure_txns", JSON.stringify(updated));
        return updated;
      });

      const options = {
        key: "rzp_test_SjPsXMmj345aei", 
        amount: amount * 100,
        currency: "INR",
        name: "PaySure (Local Demo)",
        description: "Test Transaction",
        order_id: orderData.id, 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: function (response: any) {
          // 2. On Success, update to 'received'
          setTxns(prev => {
            const updated = prev.map(t => 
              t.id === currentTxnId 
                ? { 
                    ...t, 
                    status: "received" as const, 
                    utr: `UTR${Math.floor(Math.random() * 10000000000)}` 
                  } 
                : t
            );
            localStorage.setItem("paysure_txns", JSON.stringify(updated));
            return updated;
          });
          
          alert(`Payment processed! ID: ${response.razorpay_payment_id}`);
        },
        modal: {
          ondismiss: function () {
            // 3. On Close, if not 'received', mark as 'failed'
            setTxns(prev => {
              const updated = prev.map(t => 
                t.id === currentTxnId && t.status !== 'received' 
                  ? { 
                      ...t, 
                      status: "failed" as const,
                      utr: `FAILED_${Math.floor(Math.random() * 1000000)}`
                    } 
                  : t
              );
              localStorage.setItem("paysure_txns", JSON.stringify(updated));
              return updated;
            });
          }
        },
        prefill: {
          name: "Walk-in Customer",
          contact: "9999999999"
        },
        theme: {
          color: "#ea580c"
        }
      };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp1 = new (window as any).Razorpay(options);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rzp1.on('payment.failed', function (response: any){
        // We don't update to failed yet, keep it 'verifying' as requested
        // "when I click on failure in razorpay In the logs it should show verifying"
        alert("Payment Failed: " + response.error.description);
      });
      rzp1.open();

    } catch (err) {
      console.error("Failed to open Razorpay", err);
      alert("Failed to initialize payment gateway.");
    } finally {
      setLoading(false);
    }
  };

  const selected = txns.find((t) => t.id === selectedId) ?? null;

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  const handleRefund = async (id: string) => {
    setLoading(true);
    try {
      // Simulate network delay
      await new Promise((res) => setTimeout(res, 800));

      const stamp = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      
      const updatedTxns = txns.map((t) => (t.id === id ? { ...t, status: "refunded" as const, refundedAt: stamp } : t));
      setTxns(updatedTxns);
      localStorage.setItem("paysure_txns", JSON.stringify(updatedTxns));
    } catch (err) {
      console.error("Refund failed", err);
      alert("Failed to process refund");
    } finally {
      setLoading(false);
    }
  };

  const verifyingCount = txns.filter((t) => t.status === "verifying").length;
  const duplicateCount = txns.filter((t) => t.status === "duplicate").length;
  const receivedAmount = txns.filter((t) => t.status === "received").reduce((sum, t) => sum + t.amount, 0);

  // Group txns by date while preserving chronological order
  const groupedTxns: { date: string; txns: Transaction[] }[] = [];
  txns.forEach((txn) => {
    let group = groupedTxns.find((g) => g.date === txn.date);
    if (!group) {
      group = { date: txn.date, txns: [] };
      groupedTxns.push(group);
    }
    group.txns.push(txn);
  });

  return (
    <div className="min-h-screen bg-background pb-28">
      <Header />



      {/* Summary strip */}
      <section className="px-5 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="receipt-card px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Received</p>
            <p className="font-mono-num text-xl font-bold text-green-600 mt-0.5">₹{receivedAmount.toLocaleString("en-IN")}</p>
          </div>
          <div className="receipt-card px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Verifying</p>
            <p className="font-mono-num text-xl font-bold text-verifying mt-0.5">{verifyingCount}</p>
          </div>
          <div className="receipt-card px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Duplicates</p>
            <p className="font-mono-num text-xl font-bold text-duplicate mt-0.5">{duplicateCount}</p>
          </div>
        </div>
      </section>

      <main className="px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Transaction Log
          </h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/reconcile")}
              className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-sm hover:bg-secondary/80 active:scale-95 transition-all"
            >
              <BarChart3 className="w-3 h-3" /> Reconcile
            </button>
            <button 
              onClick={createPayment} 
              disabled={loading}
              className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-3 h-3" /> Create Payment
            </button>
            <span className="text-[11px] text-muted-foreground font-mono-num">{txns.length} entries</span>
          </div>
        </div>

        <div className="space-y-6">
          {groupedTxns.map((group) => (
            <div key={group.date}>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">{group.date}</h3>
              <div className="space-y-2.5">
                {group.txns.map((t) => (
                  <TransactionCard key={t.id} txn={t} onClick={() => openDetail(t.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground mt-6">
          — End of log —
        </p>
      </main>

      {/* Floating buttons */}
      <button
        onClick={() => setProfileOpen(true)}
        aria-label="Open profile"
        className="fixed bottom-5 left-5 h-14 w-14 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-accent active:scale-95 transition-all z-20"
      >
        <User className="h-5 w-5 text-foreground" />
      </button>

      <button
        onClick={() => setChatOpen(true)}
        aria-label="Open help chat"
        className="fixed bottom-5 right-5 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all z-20"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      <TransactionDetail
        txn={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRefund={handleRefund}
      />
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
      <ChatSheet open={chatOpen} onOpenChange={setChatOpen} transactions={txns} />
    </div>
  );
};

export default Index;
