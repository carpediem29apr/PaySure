import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, ArrowRight, User, Phone, Lock, CreditCard, Hash, Building2, Calendar, Mail, AlertCircle } from "lucide-react";
import { warmUpBackend } from "@/lib/api";

type Mode = "login" | "signup";

interface StoredUser {
  name: string;
  shopName: string;
  phone: string;
  email: string;
  password: string;
  age: string;
  aadhaar: string;
  pan: string;
  merchantId: string;
  gstin: string;
}

const Login = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Login fields
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Signup fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [shopName, setShopName] = useState("");
  const [gstin, setGstin] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Wake up the backend while user fills in the login form
  useEffect(() => { warmUpBackend(); }, []);

  const handlePhoneChange = (value: string) => {
    // Only allow numeric input
    const numericOnly = value.replace(/\D/g, "");
    if (numericOnly.length <= 10) {
      setPhone(numericOnly);
    }
  };

  const getStoredUsers = (): StoredUser[] => {
    try {
      const raw = localStorage.getItem("paysure_users");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate phone length
    if (phone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    setIsSubmitting(true);

    if (mode === "signup") {
      // --- SIGN UP ---
      if (!name.trim()) {
        setError("Full name is required.");
        setIsSubmitting(false);
        return;
      }
      if (!shopName.trim()) {
        setError("Shop / Business name is required.");
        setIsSubmitting(false);
        return;
      }
      if (!email.trim()) {
        setError("Email is required.");
        setIsSubmitting(false);
        return;
      }

      const users = getStoredUsers();
      const exists = users.find((u) => u.phone === phone);
      if (exists) {
        setError("This phone number is already registered. Please login.");
        setIsSubmitting(false);
        return;
      }

      const newUser: StoredUser = {
        name,
        shopName,
        phone,
        email,
        password,
        age,
        aadhaar,
        pan,
        merchantId,
        gstin,
      };

      users.push(newUser);
      localStorage.setItem("paysure_users", JSON.stringify(users));
      localStorage.setItem("paysure_current_user", JSON.stringify(newUser));

      setTimeout(() => {
        navigate("/dashboard");
      }, 600);
    } else {
      // --- LOGIN ---
      const users = getStoredUsers();
      const found = users.find((u) => u.phone === phone && u.password === password);

      if (!found) {
        setError("Invalid phone number or password. Please try again or sign up.");
        setIsSubmitting(false);
        return;
      }

      localStorage.setItem("paysure_current_user", JSON.stringify(found));

      setTimeout(() => {
        navigate("/dashboard");
      }, 600);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-1/3 right-0 w-48 h-48 rounded-full bg-primary/3 blur-2xl" />
      </div>

      {/* Logo + branding */}
      <div className="relative z-10 flex flex-col items-center mb-8 animate-slide-up">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl scale-110" />
          <img
            src="/favicon.png"
            alt="PaySure Logo"
            className="relative h-20 w-20 object-contain drop-shadow-lg"
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Pay<span className="text-primary">Sure</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 tracking-wide">
          Trust after payment in 3 seconds
        </p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="receipt-card p-6 shadow-lg shadow-primary/5">
          {/* Mode tabs */}
          <div className="flex rounded-lg bg-secondary/60 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                mode === "login"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                mode === "signup"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Vikram Sharma"
                      className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {/* Shop / Business Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                    Shop / Business Name <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="Sharma General Store"
                      className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vikram@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {/* Age */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                    Age
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="35"
                      min="18"
                      max="120"
                      className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Phone Number (shared) */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                Phone Number <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <span className="absolute left-9 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="9810233421"
                  maxLength={10}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full pl-[4.5rem] pr-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono-num"
                />
              </div>
              {phone.length > 0 && phone.length < 10 && (
                <p className="text-[10px] text-muted-foreground">{phone.length}/10 digits</p>
              )}
            </div>

            {/* Password (shared) */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <>
                {/* Receipt-style divider */}
                <div className="receipt-divider my-1" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center font-medium">
                  KYC & Merchant Details
                </p>

                {/* Aadhaar Number */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                    Aadhaar Number
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={aadhaar}
                      onChange={(e) => setAadhaar(e.target.value)}
                      placeholder="XXXX XXXX XXXX"
                      maxLength={14}
                      className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono-num"
                    />
                  </div>
                </div>

                {/* PAN Number */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                    PAN Number
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono-num uppercase"
                    />
                  </div>
                </div>

                {/* Merchant ID */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                    Merchant ID
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={merchantId}
                      onChange={(e) => setMerchantId(e.target.value.toUpperCase())}
                      placeholder="PSR-MX-009823"
                      className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono-num"
                    />
                  </div>
                </div>

                {/* GSTIN */}
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                    GSTIN <span className="normal-case tracking-normal text-muted-foreground/60">(optional)</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="07AABCS1234N1Z5"
                      maxLength={15}
                      className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono-num uppercase"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {mode === "login" ? "Logging in…" : "Creating account…"}
                </span>
              ) : (
                <>
                  {mode === "login" ? "Login" : "Create Merchant Account"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer link */}
          <div className="receipt-divider mt-6 mb-4" />
          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>
                New to PaySure?{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary font-semibold hover:underline transition-colors"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary font-semibold hover:underline transition-colors"
                >
                  Login here
                </button>
              </>
            )}
          </p>
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            256-bit SSL Encrypted
          </span>
        </div>
      </div>
    </div>
  );
};

export default Login;
