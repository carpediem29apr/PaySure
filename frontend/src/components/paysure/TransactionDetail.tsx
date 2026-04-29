import { API_BASE } from "@/lib/api";
import { useState } from "react";
import type { Transaction } from "@/data/transactions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, Copy, Share2, FileText, AlertOctagon, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  txn: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefund: (id: string) => void;
}

const Row = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-baseline justify-between gap-4 py-2">
    <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className={`text-sm text-foreground text-right ${mono ? "font-mono-num" : "font-medium"}`}>
      {value}
    </span>
  </div>
);

export const TransactionDetail = ({ txn, open, onOpenChange, onRefund }: Props) => {
  const [proofGenerated, setProofGenerated] = useState(false);

  if (!txn) return null;

  const isDuplicate = txn.type === "duplicate" && txn.status === "duplicate";
  const isRefunded = txn.status === "refunded";

  const handleProof = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/proof/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: parseInt(txn.id) })
      });
      const data = await res.json();
      if (data.verification_url) {
        setProofGenerated(true);
        txn.utr = data.utr; // To use in share
        toast({ title: "Proof generated", description: "Share link is ready." });
      } else {
        throw new Error(data.detail || "Failed to generate proof");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/v/${txn.utr}`);
    toast({ title: "Link copied", description: "Send it to the customer." });
  };

  const handleRefund = () => {
    onRefund(txn.id);
    toast({ title: `₹${txn.amount} refunded`, description: "Sent back to the customer instantly." });
  };

  const handleClose = () => {
    setProofGenerated(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setProofGenerated(false); onOpenChange(o); }}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[92vh] overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-3 text-left">
          <div className="mx-auto h-1 w-10 rounded-full bg-border mb-3" />
          <SheetTitle className="text-base font-semibold">Transaction Detail</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-6 animate-slide-up">
          {/* Receipt-style block */}
          <div className="receipt-card p-5 bg-card">
            <div className="text-center pb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount</p>
              <p className="font-mono-num text-4xl font-bold mt-1">
                ₹{txn.amount.toLocaleString("en-IN")}
              </p>
              {isRefunded ? (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded bg-success-bg text-success text-[11px] font-bold tracking-wider">
                  <Check className="h-3 w-3" /> REFUNDED
                </div>
              ) : isDuplicate ? (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded bg-duplicate-bg text-duplicate text-[11px] font-bold tracking-wider">
                  <AlertOctagon className="h-3 w-3" /> DUPLICATE DETECTED
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded bg-verifying-bg text-verifying text-[11px] font-bold tracking-wider animate-status-pulse">
                  <Clock className="h-3 w-3" /> VERIFYING
                </div>
              )}
            </div>

            <div className="receipt-divider my-2" />

            <div className="divide-y divide-dashed divide-border">
              <Row label="Customer" value={txn.customerName ?? "—"} />
              <Row label="UPI" value={`••${txn.upiLast4}`} mono />
              <Row label="Method" value={txn.paymentMethod} />
              <Row label="Time" value={txn.time} mono />
              <Row label="UTR" value={txn.utr} mono />
              {txn.utrDuplicate && (
                <Row label="Duplicate UTR" value={txn.utrDuplicate} mono />
              )}
              {txn.refundedAt && (
                <Row label="Refunded at" value={txn.refundedAt} mono />
              )}
            </div>
          </div>

          {/* Duplicate warning block */}
          {isDuplicate && (
            <div className="mt-4 receipt-card border-duplicate/30 bg-duplicate-bg p-4">
              <div className="flex gap-3">
                <AlertOctagon className="h-5 w-5 text-duplicate shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Same payment received twice</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Two UPI references for ₹{txn.amount} from the same customer within 60 seconds.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Proof preview */}
          {proofGenerated && txn.type === "unfinished" && (
            <div className="mt-4 receipt-card p-4 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Proof link ready</p>
              </div>
              <div className="bg-muted rounded p-2.5 font-mono-num text-xs text-foreground break-all">
                {window.location.origin}/v/{txn.utr}
              </div>
              <Button onClick={handleShare} variant="outline" className="w-full mt-3 gap-2">
                <Share2 className="h-4 w-4" /> Share with customer
              </Button>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-5 space-y-2">
            {isDuplicate && (
              <Button
                onClick={handleRefund}
                className="w-full h-12 text-base font-semibold bg-duplicate hover:bg-duplicate/90 text-duplicate-foreground"
              >
                Refund Duplicate Payment
              </Button>
            )}

            {txn.type === "unfinished" && !isRefunded && !proofGenerated && (
              <Button
                onClick={handleProof}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                <FileText className="h-4 w-4" /> Generate Proof
              </Button>
            )}

            {isRefunded && (
              <Button
                onClick={() => navigator.clipboard?.writeText(txn.utr)}
                variant="outline"
                className="w-full h-12 gap-2"
              >
                <Copy className="h-4 w-4" /> Copy UTR
              </Button>
            )}

            <Button onClick={handleClose} variant="ghost" className="w-full">
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
