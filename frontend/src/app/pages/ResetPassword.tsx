import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2 } from "lucide-react";
import { passwordResetApi } from "../../api/passwordReset";

export function ResetPassword() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (!token) {
        setError("Missing reset token");
        return;
      }

      const res = await passwordResetApi.resetPassword({
        token,
        newPassword,
      });

      setMessage(res.message || "Password updated successfully");
      window.dispatchEvent(new Event('critiq:session-invalid'));

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-2xl font-mono-display mb-2">Critiq</h1>
          </Link>
          <p className="text-sm text-[var(--muted)]">Set a new password</p>
        </div>

        <div className="bg-[var(--surface)] border border-border rounded-md p-6 sm:p-8">
          {!token && <p role="alert">This reset link is missing or invalid. <Link to="/forgot-password" className="underline">Request a new link</Link>.</p>}
          {message && (
            <div className="mb-4 px-3 py-2.5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded text-sm text-[var(--accent)]">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !token || Boolean(message)}
              className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 border-0 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Update password"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            Remembered your password?{" "}
            <Link to="/login" className="text-[var(--accent)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

