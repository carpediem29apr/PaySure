import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react";

interface ReconcileData {
  date: string;
  total_transactions: number;
  captured_count: number;
  captured_amount: number;
  pending_count: number;
  pending_amount: number;
  failed_count: number;
  failed_amount: number;
  refunded_count: number;
  refunded_amount: number;
  missing: { utr: string; amount: number; time: string; phone: string; status: string }[];
}

const Reconcile = () => {
  const [data, setData] = useState<ReconcileData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchReconcile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reconcile`);
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setData(d);
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReconcile();
  }, []);

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (!data)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Failed to load reconciliation data.</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-gray-500 hover:text-gray-900 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-900">Daily Reconciliation</h1>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">{data.date}</p>
            </div>
          </div>
          <button
            onClick={fetchReconcile}
            className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow hover:bg-orange-600 active:scale-95 transition-all"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </header>

      <div className="px-5 py-6 space-y-5 max-w-xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard icon={<CheckCircle className="w-5 h-5 text-green-500" />} label="Confirmed" count={data.captured_count} amount={data.captured_amount} color="green" />
          <SummaryCard icon={<Clock className="w-5 h-5 text-amber-500" />} label="Pending" count={data.pending_count} amount={data.pending_amount} color="amber" />
          <SummaryCard icon={<AlertTriangle className="w-5 h-5 text-red-500" />} label="Failed" count={data.failed_count} amount={data.failed_amount} color="red" />
          <SummaryCard icon={<RefreshCw className="w-5 h-5 text-blue-500" />} label="Refunded" count={data.refunded_count} amount={data.refunded_amount} color="blue" />
        </div>

        {/* Expected vs Received */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Expected vs Received</h2>
          <div className="space-y-3">
            <RecRow label="UPI Expected (All)" value={`₹${(data.captured_amount + data.pending_amount + data.failed_amount).toLocaleString("en-IN")}`} />
            <RecRow label="Bank Confirmed" value={`₹${data.captured_amount.toLocaleString("en-IN")}`} highlight="green" />
            <RecRow label="Pending Confirmation" value={`₹${data.pending_amount.toLocaleString("en-IN")}`} highlight="amber" />
            <RecRow label="Failed / Lost" value={`₹${data.failed_amount.toLocaleString("en-IN")}`} highlight="red" />
          </div>
        </div>

        {/* Missing / Unconfirmed */}
        {data.missing.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-5">
            <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Missing / Unconfirmed ({data.missing.length})
            </h2>
            <div className="space-y-3">
              {data.missing.map((m) => (
                <div key={m.utr} className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-bold text-gray-900">₹{m.amount.toLocaleString("en-IN")}</span>
                    <span className="text-[11px] text-gray-400 font-mono">{m.time}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono">UTR: {m.utr}</p>
                  <p className="text-[11px] text-gray-500">Customer: {m.phone}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.missing.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-green-800">All payments reconciled!</p>
            <p className="text-xs text-green-600 mt-1">No missing or unconfirmed transactions found today.</p>
          </div>
        )}

        {/* Total */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-center text-white shadow-lg">
          <p className="text-[10px] uppercase tracking-widest font-semibold opacity-80 mb-1">Today's Total</p>
          <p className="text-3xl font-bold font-mono">₹{data.captured_amount.toLocaleString("en-IN")}</p>
          <p className="text-xs opacity-80 mt-1">{data.total_transactions} transactions processed</p>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ icon, label, count, amount, color }: any) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-lg font-bold text-gray-900 font-mono">{count}</p>
    <p className={`text-xs font-mono text-${color}-600`}>₹{amount.toLocaleString("en-IN")}</p>
  </div>
);

const RecRow = ({ label, value, highlight }: { label: string; value: string; highlight?: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-dashed border-gray-100 last:border-0">
    <span className="text-xs text-gray-500">{label}</span>
    <span className={`text-sm font-bold font-mono ${highlight ? `text-${highlight}-600` : "text-gray-900"}`}>
      {value}
    </span>
  </div>
);

export default Reconcile;
