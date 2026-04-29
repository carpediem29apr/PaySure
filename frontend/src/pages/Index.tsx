import { useState, useEffect } from "react";
import { Header } from "@/components/paysure/Header";
import { TransactionCard } from "@/components/paysure/TransactionCard";
import { TransactionDetail } from "@/components/paysure/TransactionDetail";
import { ProfileSheet } from "@/components/paysure/ProfileSheet";
import { ChatSheet } from "@/components/paysure/ChatSheet";
import { type Transaction } from "@/data/transactions";
import { User, MessageCircle, Plus, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "@/lib/api";

const Index = () => {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch transactions from FastAPI backend
  const fetchTxns = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/transactions`);
      // Map backend fields to frontend Transaction interface
      const mapped = res.data.map((t: any) => ({
        id: t.id.toString(),
        type: t.status === "captured" ? "standard" : (t.status === "failed" ? "unfinished" : "unfinished"),
        amount: t.amount,
        status: t.status === "captured" ? "received" : (t.status === "refunded" ? "refunded" : "verifying"),
        date: new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        time: new Date(t.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
        customerName: t.customer_phone || "Walk-in",
        utr: t.utr,
        paymentMethod: t.description || "UPI Payment",
        refundedAt: t.refund_id ? new Date().toLocaleTimeString() : undefined
      }));
      setTxns(mapped);
    } catch (err) {
      console.error("Failed to fetch transactions", err);
    }
  };

  useEffect(() => {
    fetchTxns();
    // Auto-refresh every 5 seconds to catch new webhook payments
    const interval = setInterval(fetchTxns, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const createPayment = async () => {
    const amountStr = window.prompt("Enter amount to charge (in ₹):", "100");
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return alert("Invalid amount");

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/payments/create-order`, {
        amount,
        customer_phone: "+919876543210",
        description: "Test Payment from PaySure UI"
      });
      
      const resLoaded = await loadRazorpay();
      if (!resLoaded) {
        alert("Razorpay SDK failed to load");
        setLoading(false);
        return;
      }

      const options = {
        key: res.data.key_id,
        amount: res.data.transaction.amount * 100,
        currency: "INR",
        name: "PaySure",
        description: "Payment for order",
        order_id: res.data.razorpay_order_id,
        handler: async function (response: any) {
          try {
            await axios.post(`${API_BASE}/api/payments/confirm`, {
              transaction_id: res.data.transaction.id,
              razorpay_payment_id: response.razorpay_payment_id
            });
          } catch (e) {
            console.error("Failed to confirm payment", e);
          }
          alert(`Payment successful! ID: ${response.razorpay_payment_id}`);
          fetchTxns();
        },
        prefill: {
          contact: "+919876543210"
        },
        theme: {
          color: "#000000"
        }
      };

      console.log("Create Order Response:", res.data);
      console.log("Razorpay Options:", options);

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.on('payment.failed', function (response: any) {
        console.error("Razorpay Payment Failed Event:", response.error);
        alert("Payment Failed: " + response.error.description);
      });
      paymentObject.open();
    } catch (err) {
      console.error("Caught error in createPayment:", err);
      alert("Failed to create payment");
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
      const res = await axios.post(`${API_BASE}/api/refund`, {
        transaction_id: parseInt(id),
        reason: "Duplicate payment requested refund"
      });
      const stamp = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      setTxns((all) =>
        all.map((t) => (t.id === id ? { ...t, status: "refunded", refundedAt: stamp } : t)),
      );
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
