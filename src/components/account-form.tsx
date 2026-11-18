"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
async function request(path: string, method: string, data: unknown) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error?.fields?.fieldErrors
        ? Object.entries(result.error.fields.fieldErrors)
            .map(
              ([key, values]) => `${key}: ${(values as string[]).join(", ")}`,
            )
            .join(" · ")
        : result.error?.message || "Unable to complete this request",
    );
  return result;
}
export function AccountForm({
  mode,
  email = "",
  purpose = "VERIFY",
}: {
  mode: "login" | "register" | "verify" | "recovery";
  email?: string;
  purpose?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const reset = mode === "recovery" || purpose === "RESET";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "register") {
        await request("/api/account/register", "POST", {
          ...data,
          terms: data.terms === "on",
          community: data.community === "on",
          privacy: data.privacy === "on",
        });
        router.push(`/verify?email=${encodeURIComponent(String(data.email))}`);
      } else if (mode === "login") {
        await request("/api/account/login", "POST", data);
        router.push("/dashboard");
        router.refresh();
      } else if (mode === "recovery" && !sent) {
        const result = await request("/api/account/recovery", "POST", {
          email: data.email,
        });
        setMessage(result.message);
        setSent(true);
      } else {
        const result = await request(
          purpose === "EMAIL_CHANGE"
            ? "/api/account/email"
            : reset
              ? "/api/account/recovery"
              : "/api/account/verify",
          reset || purpose === "EMAIL_CHANGE" ? "PATCH" : "POST",
          data,
        );
        setMessage(result.message);
        if (!reset && purpose !== "EMAIL_CHANGE")
          router.push("/login?verified=1");
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        {mode === "register" && (
          <label className="field span-2">
            Full name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
        )}
        <label className="field span-2">
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={email}
          />
        </label>
        {(mode === "verify" || (mode === "recovery" && sent)) && (
          <label className="field span-2">
            Six-digit verification code
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
            />
            <small>
              Codes expire after ten minutes unless the academy configures a
              different period.
            </small>
          </label>
        )}
        {(mode === "register" ||
          mode === "login" ||
          (reset && (mode === "verify" || sent))) && (
          <label className="field span-2">
            {reset ? "New password" : "Password"}
            <input
              type="password"
              name="password"
              required
              minLength={mode === "login" ? 1 : 12}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
            {mode !== "login" && (
              <small>
                Use at least 12 characters. A unique passphrase works well.
              </small>
            )}
          </label>
        )}
        {(mode === "register" || (reset && (mode === "verify" || sent))) && (
          <label className="field span-2">
            Confirm password
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
        )}
        {mode === "register" && (
          <>
            <label className="field">
              Student ID (optional)
              <input name="studentId" maxLength={80} />
            </label>
            <label className="field">
              Institution or class (optional)
              <input name="institution" maxLength={160} />
            </label>
            <label className="check-field span-2">
              <input type="checkbox" name="terms" required />I agree to the{" "}
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                terms of service
              </Link>
              .
            </label>
            <label className="check-field span-2">
              <input type="checkbox" name="community" required />I agree to the{" "}
              <Link
                href="/community-guidelines"
                target="_blank"
                rel="noopener noreferrer"
              >
                community guidelines
              </Link>
              .
            </label>
            <label className="check-field span-2">
              <input type="checkbox" name="privacy" required />I consent to the{" "}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                privacy policy
              </Link>
              .
            </label>
          </>
        )}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="success" role="status">
          {message}
        </div>
      )}
      <div className="form-actions">
        <button className="button" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create account"
                : mode === "recovery" && !sent
                  ? "Send reset code"
                  : reset
                    ? "Reset password"
                    : "Verify email"}
        </button>
        {mode === "verify" && purpose === "VERIFY" && (
          <button
            type="button"
            disabled={busy}
            className="text-button"
            onClick={async (event) => {
              const form = event.currentTarget.form!;
              const address = new FormData(form).get("email");
              setBusy(true);
              try {
                const result = await request("/api/account/resend", "POST", {
                  email: address,
                });
                setMessage(result.message);
                setError("");
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Resend code
          </button>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 15,
          flexWrap: "wrap",
          marginTop: 22,
          fontSize: 12,
        }}
      >
        {mode !== "login" && <Link href="/login">Sign in</Link>}
        {mode !== "register" && <Link href="/register">Create an account</Link>}
        {mode === "login" && (
          <>
            <Link href="/verify">Verify your email</Link>
            <Link href="/recovery">Forgot password?</Link>
          </>
        )}
      </div>
    </form>
  );
}
export function AccountSecurity() {
  const [message, setMessage] = useState("");
  const [sessions, setSessions] = useState<
    { id: string; expires: string; current: boolean }[] | null
  >(null);
  async function submit(event: React.FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    try {
      const result = await request(
        path,
        path.endsWith("/email") ? "POST" : "PATCH",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      setMessage(result.message);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Change password</h2>
        <form onSubmit={(e) => submit(e, "/api/account/password")}>
          <div className="form-grid">
            <label className="field span-2">
              Current password
              <input
                type="password"
                name="currentPassword"
                required
                autoComplete="current-password"
              />
            </label>
            <label className="field">
              New password
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="button">
              Change password and sign out devices
            </button>
          </div>
        </form>
      </section>
      <section className="panel">
        <h2>Change email address</h2>
        <p className="page-subtitle">
          Verify the new address before it replaces your current email. All
          sessions will end and collaboration eligibility will be checked again.
        </p>
        <form onSubmit={(e) => submit(e, "/api/account/email")}>
          <div className="form-grid">
            <label className="field">
              New email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label className="field">
              Current password
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="button">Send confirmation code</button>
            <Link href="/verify?purpose=EMAIL_CHANGE">
              Enter email-change code
            </Link>
          </div>
        </form>
      </section>
      <section className="panel">
        <h2>Collaboration rules</h2>
        <p className="page-subtitle">
          Collaboration is currently limited to verified Vic Academy email
          accounts. Collaborators must respect attribution, keep private
          materials confidential, communicate respectfully, and never use
          another student’s work as their own.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await request("/api/account/collaboration-rules", "POST", {
                accepted: true,
              });
              setMessage(
                "Collaboration rules accepted. Eligible approved workspaces are now available.",
              );
            } catch (error) {
              setMessage((error as Error).message);
            }
          }}
        >
          <label className="check-field">
            <input type="checkbox" required />I have read and accept the
            collaboration rules.
          </label>
          <div className="form-actions">
            <button className="button">Accept collaboration rules</button>
          </div>
        </form>
      </section>
      <section className="panel">
        <h2>Active sessions</h2>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              const response = await fetch("/api/account/sessions");
              const data = await response.json();
              if (!response.ok) throw new Error(data.error?.message);
              setSessions(data.sessions);
            } catch (error) {
              setMessage((error as Error).message);
            }
          }}
        >
          Review sessions
        </button>
        {sessions?.map((session) => (
          <div className="file-row" key={session.id}>
            <span>
              {session.current ? "This device" : "Other device"}
              <small>
                Expires {new Date(session.expires).toLocaleString()}
              </small>
            </span>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await request("/api/account/sessions", "DELETE", {
                    id: session.id,
                  });
                  setSessions(sessions.filter((s) => s.id !== session.id));
                  setMessage("Session revoked");
                } catch (error) {
                  setMessage((error as Error).message);
                }
              }}
            >
              Sign out
            </button>
          </div>
        ))}
      </section>
      {message && (
        <div className="success" role="status">
          {message}
        </div>
      )}
    </>
  );
}
