import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import { AlertTriangle } from "lucide-react";

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setHasError(false);
    setLoading(true);

    console.log("[LoginPage] Sending user login API request to backend for:", email);

    try {
      const { error, user } = await login(email, password);
      setLoading(false);

      if (error) {
        console.error("[LoginPage] Login failed:", error.message);
        setHasError(true);
        setErrorMessage(
          error.message || "Invalid email or password. Please check your credentials and try again."
        );
        setRemainingAttempts((prev) => (prev === null ? 2 : Math.max(0, prev - 1)));
      } else {
        console.log("[LoginPage] Logged in successfully:", user);
        navigate("/");
      }
    } catch (err: any) {
      console.error("[LoginPage] Unexpected error during login:", err);
      setLoading(false);
      setHasError(true);
      setErrorMessage(err?.message || "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F4F5F7] px-4 py-8">
      <div className="w-full max-w-[440px] bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sm:p-10 transition-all">
        {/* Logo Badge */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-[#65D000] flex items-center justify-center shadow-sm">
            <span className="text-white font-extrabold text-xl tracking-tight">OL</span>
          </div>
        </div>

        {/* Header Text */}
        <div className="text-center mt-5 space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Super Admin
          </h1>
        </div>

        {/* Error Notification Banner (matching screenshot) */}
        {hasError && (
          <div className="mt-5 rounded-xl bg-[#FFF5F5] border border-[#FEB2B2] p-3 flex items-start gap-2.5 text-xs text-[#E53E3E] transition-all">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#E53E3E] mt-0.5" />
            <span className="leading-tight font-medium">
              {errorMessage ||
                "Invalid email or password. Please check your credentials and try again."}
            </span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Email Address */}
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (hasError) setHasError(false);
              }}
              placeholder="shop.admin@onelatur.com"
              required
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors outline-none placeholder:text-slate-400 ${
                hasError
                  ? "border-[#FEB2B2] bg-[#FFF5F5]/30 focus:border-[#E53E3E] focus:ring-1 focus:ring-[#E53E3E]"
                  : "border-slate-200 focus:border-[#65D000] focus:ring-2 focus:ring-[#65D000]/20"
              }`}
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <button
                type="button"
                className="text-[11px] font-medium text-[#65D000] hover:underline hover:text-[#55b300]"
                onClick={() => alert("Password reset link will be sent to your email address.")}
              >
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (hasError) setHasError(false);
              }}
              placeholder="••••••••"
              required
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors outline-none placeholder:text-slate-400 ${
                hasError
                  ? "border-[#FEB2B2] bg-[#FFF5F5]/30 focus:border-[#E53E3E] focus:ring-1 focus:ring-[#E53E3E]"
                  : "border-slate-200 focus:border-[#65D000] focus:ring-2 focus:ring-[#65D000]/20"
              }`}
            />
            {hasError && remainingAttempts !== null && (
              <p className="mt-1.5 text-xs text-[#E53E3E] font-medium">
                Incorrect password. {remainingAttempts} attempts remaining.
              </p>
            )}
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#65D000] hover:bg-[#58b800] active:scale-[0.99] text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center disabled:opacity-70 cursor-pointer"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Signing In...</span>
              </div>
            ) : (
              "Sign In"
            )}
          </button>

          <p className="text-center pt-2 text-xs text-slate-500">
            Access is by invitation from a platform administrator.
          </p>
        </form>
      </div>
    </div>
  );
};
