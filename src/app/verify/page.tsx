import { AccountForm } from "@/components/account-form";
export const metadata = { title: "Verify your email" };
export default async function Verify({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; purpose?: string }>;
}) {
  const p = await searchParams;
  return (
    <div className="container page">
      <div className="panel" style={{ maxWidth: 550, margin: "25px auto" }}>
        <span className="eyebrow">ONE MORE STEP</span>
        <h1 className="page-title">Check your inbox.</h1>
        <p className="page-subtitle">
          Enter the six numeric digits from your verification email. Codes are
          single-use and have limited attempts.
        </p>
        <AccountForm
          mode="verify"
          email={p.email}
          purpose={
            ["VERIFY", "RESET", "EMAIL_CHANGE"].includes(p.purpose || "")
              ? p.purpose
              : "VERIFY"
          }
        />
      </div>
    </div>
  );
}
