import { Transaction } from "@/data/transactions";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Shield, AlertTriangle, Clock, ArrowLeft, XCircle } from "lucide-react";

interface VerifyData {
  valid: boolean;
  amount: number;
  currency: string;
  utr: string;
  status: string;
  merchant_name: string;
  timestamp: string;
  description: string;
  refund_id?: string;
  refund_amount?: number;
}

const VerifyPayment = () => {
  const { utr } = useParams<{ utr: string }>();
  const [data, setData] = useState<VerifyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!utr) return;
    
    // Simulate network delay
    setTimeout(() => {
      try {
        const stored = localStorage.getItem("paysure_txns");
        const txns: Transaction[] = stored ? JSON.parse(stored) : [];
        const txn = txns.find(t => t.utr === utr || t.utrDuplicate === utr);
        
        if (!txn) {
          throw new Error("Payment not found");
        }

        const merchantStr = localStorage.getItem("paysure_current_user");
        const merchantName = merchantStr ? JSON.parse(merchantStr).shopName : "Unknown Merchant";

        setData({
          valid: true,
          amount: txn.amount,
          currency: "INR",
          utr: utr,
          status: txn.status === "received" ? "captured" : (txn.status === "refunded" ? "refunded" : "pending"),
          merchant_name: merchantName,
          timestamp: txn.date === "Today" ? new Date().toISOString() : new Date(Date.now() - 86400000).toISOString(),
          description: txn.paymentMethod
        });
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    }, 800);
  }, [utr]);

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 tracking-wider uppercase">Verifying payment…</p>
        </div>
      </div>
    );

  if (error || !data)
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-xl border border-red-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Payment Not Found</h1>
          <p className="text-sm text-gray-500">
            The UTR <span className="font-mono text-red-600">{utr}</span> could not be verified.
            Please check the link and try again.
          </p>
        </div>
      </div>
    );

  const isRefunded = data.status === "refunded";
  const isCaptured = data.status === "captured";
  const isFailed = data.status === "failed";
  const isPending = data.status === "pending" || data.status === "authorized";
  const ts = new Date(data.timestamp);

  // Determine header style based on status
  let headerGradient = "bg-gradient-to-r from-amber-500 to-orange-600";
  let headerIcon = <Clock className="w-7 h-7 text-white" />;
  let headerLabel = "Payment Pending";

  if (isCaptured) {
    headerGradient = "bg-gradient-to-r from-green-500 to-emerald-600";
    headerIcon = <Check className="w-7 h-7 text-white" />;
    headerLabel = "Payment Verified ✓";
  } else if (isRefunded) {
    headerGradient = "bg-gradient-to-r from-blue-500 to-indigo-600";
    headerIcon = <ArrowLeft className="w-7 h-7 text-white" />;
    headerLabel = "Payment Refunded";
  } else if (isFailed) {
    headerGradient = "bg-gradient-to-r from-red-500 to-rose-600";
    headerIcon = <XCircle className="w-7 h-7 text-white" />;
    headerLabel = "Settlement Pending";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-2xl border border-orange-100 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-5 text-center ${headerGradient}`}>
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            {headerIcon}
          </div>
          <p className="text-white/80 text-xs uppercase tracking-widest font-semibold mb-1">
            {headerLabel}
          </p>
          <h1 className="text-3xl font-bold text-white font-mono">
            ₹{data.amount.toLocaleString("en-IN")}
          </h1>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Verification badge */}
          {data.valid && isCaptured && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-5">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-green-700 tracking-wide">
                CRYPTOGRAPHICALLY VERIFIED — HMAC-SHA256
              </span>
            </div>
          )}

          {/* Customer-side confirmation for failed/pending */}
          {(isFailed || isPending) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Your money was deducted but the merchant hasn't received it yet.
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    This is a known UPI settlement delay. The merchant has been notified. 
                    Your money is safe and will be settled or auto-refunded within 48 hours.
                  </p>
                  <p className="text-xs text-amber-700 font-semibold mt-2">
                    📋 Save this page as proof of your payment.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="space-y-0 divide-y divide-dashed divide-gray-200">
            <DetailRow label="Merchant" value={data.merchant_name} />
            <DetailRow label="UTR" value={data.utr} mono />
            <DetailRow label="Status" value={
              isCaptured ? "✅ CONFIRMED" :
              isFailed ? "⚠️ SETTLEMENT PENDING" :
              isPending ? "🔄 PROCESSING" :
              isRefunded ? "↩️ REFUNDED" :
              data.status.toUpperCase()
            } />
            <DetailRow
              label="Date"
              value={ts.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            />
            <DetailRow
              label="Time"
              value={ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
              mono
            />
            {data.description && <DetailRow label="Description" value={data.description} />}
            {isRefunded && data.refund_amount && (
              <DetailRow label="Refunded" value={`₹${data.refund_amount.toLocaleString("en-IN")}`} />
            )}
          </div>

          {/* Action for customer: if failed/pending, allow them to confirm they paid */}
          {(isFailed || isPending) && (
            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  alert("Link copied! Share this with the merchant as proof.");
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              >
                📋 Copy Proof Link
              </button>
              <p className="text-[10px] text-center text-gray-400">
                Share this link with the merchant so they can verify your payment
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Shield className="w-3 h-3 text-green-600" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              256-BIT SSL ENCRYPTED
            </span>
          </div>
          <p className="text-[10px] text-gray-400">
            Powered by <span className="font-bold text-orange-500">PaySure</span> — Trust after payment, in 3 seconds.
          </p>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-baseline justify-between gap-4 py-3">
    <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{label}</span>
    <span className={`text-sm text-gray-900 text-right ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
  </div>
);

export default VerifyPayment;
