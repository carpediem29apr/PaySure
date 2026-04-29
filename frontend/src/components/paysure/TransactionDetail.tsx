import { API_BASE } from "@/lib/api";
import { useState } from "react";
import type { Transaction } from "@/data/transactions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, Copy, Share2, FileText, AlertOctagon, Clock, Mail, QrCode } from "lucide-react";
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
  const [showQR, setShowQR] = useState(false);

  if (!txn) return null;

  const isDuplicate = txn.type === "duplicate" && txn.status === "duplicate";
  const isRefunded = txn.status === "refunded";
  const isVerifying = txn.status === "verifying";
  const isReceived = txn.status === "received";

  // Always use the deployed Vercel URL for QR codes (not localhost)
  const appUrl = import.meta.env.VITE_APP_URL || (window.location.hostname === "localhost" ? "https://paysure-five.vercel.app" : window.location.origin);
  const verifyUrl = `${appUrl}/v/${txn.utr}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(verifyUrl)}`;

  const handleProof = async () => {
    try {
      const token = localStorage.getItem("paysure_token");
      const res = await fetch(`${API_BASE}/api/proof/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ transaction_id: String(txn.id) })
      });
      const data = await res.json();
      if (data.verification_url) {
        setProofGenerated(true);
        txn.utr = data.utr;
        toast({ title: "Proof generated", description: "Share link is ready." });
      } else {
        const errorMessage = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail;
        throw new Error(errorMessage || "Failed to generate proof");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(verifyUrl);
    toast({ title: "Link copied", description: "Send it to the customer." });
  };

  const handleRefund = () => {
    onRefund(txn.id);
    toast({ title: `₹${txn.amount} refunded`, description: "Sent back to the customer instantly." });
  };

  const handleEmailBank = () => {
    const subject = encodeURIComponent(`Payment Dispute - UTR ${txn.utr} - Amount ₹${txn.amount}`);
    const body = encodeURIComponent(
`Dear Sir/Madam,

I am writing to report a payment dispute for the following transaction:

━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSACTION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━
Amount: ₹${txn.amount.toLocaleString("en-IN")}
UTR: ${txn.utr}
Date & Time: ${txn.date} at ${txn.time}
Customer: ${txn.customerName || "N/A"}
Payment Method: ${txn.paymentMethod || "UPI"}
Status on Merchant End: ${txn.status?.toUpperCase()}

ISSUE: The customer's UPI app shows "Payment Successful" and their account has been debited. However, the above amount has NOT been credited to my merchant account.

PROOF OF TRANSACTION:
Verification Link: ${verifyUrl}

Please investigate and credit the amount to my account at the earliest.

Regards,
Sharma General Store
PaySure Merchant ID: PSR-1`
    );
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, "_blank");
    toast({ title: "Gmail opened", description: "Dispute email drafted with transaction proof." });
  };

  const handleClose = () => {
    setProofGenerated(false);
    setShowQR(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setProofGenerated(false); setShowQR(false); } onOpenChange(o); }}>
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
              ) : isReceived ? (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded bg-green-100 text-green-700 text-[11px] font-bold tracking-wider">
                  <Check className="h-3 w-3" /> RECEIVED
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

          {/* QR Code Block */}
          <div className="mt-4 receipt-card p-4">
            <button
              onClick={() => setShowQR(!showQR)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Payment QR Code</span>
              </div>
              <span className="text-xs text-muted-foreground">{showQR ? "Hide" : "Show"}</span>
            </button>
            {showQR && (
              <div className="mt-3 animate-slide-up text-center">
                <img
                  src={qrCodeUrl}
                  alt="Transaction QR Code"
                  className="mx-auto rounded-lg border border-border shadow-sm"
                  width={200}
                  height={200}
                />
                <p className="text-[10px] text-muted-foreground mt-2 break-all px-4">{verifyUrl}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Customer scans this → sees payment proof instantly
                </p>
              </div>
            )}
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
          {proofGenerated && (
            <div className="mt-4 receipt-card p-4 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Proof link ready</p>
              </div>
              <div className="bg-muted rounded p-2.5 font-mono-num text-xs text-foreground break-all">
                {verifyUrl}
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

            {!isRefunded && !proofGenerated && (
              <Button
                onClick={handleProof}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                <FileText className="h-4 w-4" /> Generate Proof
              </Button>
            )}

            {/* Email Bank - for failed/pending/verifying transactions */}
            {(isVerifying || txn.status === "failed" || txn.status === "pending") && (
              <Button
                onClick={handleEmailBank}
                variant="outline"
                className="w-full h-12 text-base font-semibold gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Mail className="h-4 w-4" /> Email Dispute to Bank
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
