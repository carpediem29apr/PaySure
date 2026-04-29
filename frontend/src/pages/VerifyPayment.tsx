import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Shield, AlertTriangle, Clock, ArrowLeft } from "lucide-react";

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
    fetch(`${API_BASE}/api/verify/${utr}`)
      .then((res) => {
        if (!res.ok) throw new Error("Payment not found");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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
  const isPending = data.status === "pending" || data.status === "authorized";
  const ts = new Date(data.timestamp);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-2xl border border-orange-100 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div
          className={`px-6 py-5 text-center ${
            isCaptured
              ? "bg-gradient-to-r from-green-500 to-emerald-600"
              : isRefunded
              ? "bg-gradient-to-r from-blue-500 to-indigo-600"
              : "bg-gradient-to-r from-amber-500 to-orange-600"
          }`}
        >
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            {isCaptured ? (
              <Check className="w-7 h-7 text-white" />
            ) : isRefunded ? (
              <ArrowLeft className="w-7 h-7 text-white" />
            ) : (
              <Clock className="w-7 h-7 text-white" />
            )}
          </div>
          <p className="text-white/80 text-xs uppercase tracking-widest font-semibold mb-1">
            {isCaptured ? "Payment Verified" : isRefunded ? "Payment Refunded" : "Payment Pending"}
          </p>
          <h1 className="text-3xl font-bold text-white font-mono">
            ₹{data.amount.toLocaleString("en-IN")}
          </h1>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Verification badge */}
          {data.valid && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-5">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-green-700 tracking-wide">
                CRYPTOGRAPHICALLY VERIFIED — HMAC-SHA256
              </span>
            </div>
          )}

          {/* Details */}
          <div className="space-y-0 divide-y divide-dashed divide-gray-200">
            <DetailRow label="Merchant" value={data.merchant_name} />
            <DetailRow label="UTR" value={data.utr} mono />
            <DetailRow label="Status" value={data.status.toUpperCase()} />
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
