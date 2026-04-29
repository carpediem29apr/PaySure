import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { merchantProfile } from "@/data/transactions";
import { Store } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Field = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="py-3">
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
    <p className={`text-sm text-foreground ${mono ? "font-mono-num" : "font-medium"}`}>{value}</p>
  </div>
);

export const ProfileSheet = ({ open, onOpenChange }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-6 pb-4 text-left border-b border-border">
          <SheetTitle className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold">{merchantProfile.name}</p>
              <p className="text-xs text-muted-foreground font-normal">{merchantProfile.ownerName}</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 py-4">
          <div className="receipt-card p-5">
            <div className="text-center pb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Merchant Profile</p>
              <p className="font-mono-num text-xs text-foreground mt-1">{merchantProfile.merchantId}</p>
            </div>
            <div className="receipt-divider my-2" />
            <div className="divide-y divide-dashed divide-border">
              <Field label="Owner" value={merchantProfile.ownerName} />
              <Field label="Phone" value={merchantProfile.phone} mono />
              <Field label="Email" value={merchantProfile.email} />
              <Field label="UPI ID" value={merchantProfile.upiId} mono />
              <Field label="GSTIN" value={merchantProfile.gstin} mono />
              <Field label="Address" value={merchantProfile.address} />
            </div>
            <div className="receipt-divider my-3" />
            <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              Verified Merchant · PaySure
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
