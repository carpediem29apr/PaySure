import type { Transaction } from "@/data/transactions";
import { ChevronRight } from "lucide-react";

interface Props {
  txn: Transaction;
  onClick: () => void;
}

const formatAmount = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0 });

export const TransactionCard = ({ txn, onClick }: Props) => {
  const isDuplicate = txn.type === "duplicate" && txn.status === "duplicate";
  const isRefunded = txn.status === "refunded";
  const isVerifying = txn.status === "verifying";

  const statusConfig = isRefunded
    ? {
        label: "REFUNDED",
        bg: "bg-success-bg",
        text: "text-success",
        border: "border-l-success",
      }
    : isDuplicate
    ? {
        label: "DUPLICATE DETECTED",
        bg: "bg-duplicate-bg",
        text: "text-duplicate",
        border: "border-l-duplicate",
      }
    : {
        label: "VERIFYING",
        bg: "bg-verifying-bg",
        text: "text-verifying",
        border: "border-l-verifying",
      };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left receipt-card border-l-4 ${statusConfig.border} hover:bg-accent/40 active:scale-[0.99] transition-all`}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${statusConfig.bg} ${statusConfig.text} ${
                  isVerifying ? "animate-status-pulse" : ""
                }`}
              >
                {statusConfig.label}
              </span>
              {isRefunded && <span className="text-success text-sm">✓</span>}
            </div>
            <div className="font-mono-num text-2xl font-bold text-foreground">
              {formatAmount(txn.amount)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground truncate">
              {txn.customerName}
              {txn.upiLast4 && (
                <span className="font-mono-num"> · ••{txn.upiLast4}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="font-mono-num text-xs text-muted-foreground">
              {txn.time}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </button>
  );
};
