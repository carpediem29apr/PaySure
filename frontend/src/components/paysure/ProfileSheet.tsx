import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { merchantProfile } from "@/data/transactions";
import { Store, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<any>(merchantProfile);

  useEffect(() => {
    if (open) {
      fetch("http://localhost:8000/api/auth/me")
        .then(res => res.json())
        .then(data => {
          if (data && data.business_name) {
            setMerchant({
              ...merchantProfile,
              name: data.business_name,
              phone: data.phone,
              email: data.email,
              merchantId: `PSR-${data.id}`
            });
          }
        })
        .catch(err => console.error(err));
    }
  }, [open]);

  const handleLogout = () => {
    onOpenChange(false);
    navigate("/");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-6 pb-4 text-left border-b border-border">
          <SheetTitle className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold">{merchant.name}</p>
              <p className="text-xs text-muted-foreground font-normal">{merchant.ownerName}</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 py-4">
          <div className="receipt-card p-5">
            <div className="text-center pb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Merchant Profile</p>
              <p className="font-mono-num text-xs text-foreground mt-1">{merchant.merchantId}</p>
            </div>
            <div className="receipt-divider my-2" />
            <div className="divide-y divide-dashed divide-border">
              <Field label="Owner" value={merchant.ownerName} />
              <Field label="Phone" value={merchant.phone} mono />
              <Field label="Email" value={merchant.email} />
              <Field label="UPI ID" value={merchant.upiId} mono />
              <Field label="GSTIN" value={merchant.gstin} mono />
              <Field label="Address" value={merchant.address} />
            </div>
            <div className="receipt-divider my-3" />
            <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              Verified Merchant · PaySure
            </p>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full mt-4 py-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive font-semibold text-sm flex items-center justify-center gap-2 hover:bg-destructive/10 active:scale-[0.98] transition-all duration-150"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
