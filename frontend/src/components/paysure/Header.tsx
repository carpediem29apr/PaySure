import { useEffect, useState } from "react";
import { merchantProfile } from "@/data/transactions";

const formatDateTime = (d: Date) =>
  d.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

export const Header = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="/favicon.png" 
              alt="PaySure Logo" 
              className="h-8 w-8 object-contain"
            />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Pay<span className="text-primary">Sure</span>
            </h1>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              Merchant
            </span>
          </div>
          <div className="font-mono-num text-xs text-muted-foreground">
            {formatDateTime(now)}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success animate-status-pulse" />
          <p className="text-sm font-medium text-foreground truncate">
            {merchantProfile.name}
          </p>
          <span className="text-[10px] text-muted-foreground ml-auto font-mono-num">
            {merchantProfile.merchantId}
          </span>
        </div>
      </div>
    </header>
  );
};
