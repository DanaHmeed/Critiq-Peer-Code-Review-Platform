import { AuthShell } from '../components/public/AuthShell'
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Loader2 } from "lucide-react";
import { passwordResetApi } from "../../api/passwordReset";

export function ForgotPassword() {

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await passwordResetApi.forgotPassword({ email });
      setMessage(res.message);

    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Get back to the conversation.">
          {message && (
            <div role="status" className="mb-4 px-3 py-2.5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded text-sm text-[var(--accent)]">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 border-0 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            Remembered your password?{" "}
            <Link to="/login" className="text-[var(--accent)] hover:underline">
              Sign in
            </Link>
          </p>
    </AuthShell>
  );
}
