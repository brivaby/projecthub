import { AccountForm } from "@/components/account-form";
export const metadata = { title: "Sign in to Vic Academy ProjectHub" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const p = await searchParams;
  return (
    <div className="container page">
      <div className="panel" style={{ maxWidth: 500, margin: "25px auto" }}>
        <span className="eyebrow">VIC ACADEMY PROJECTHUB</span>
        <h1 className="page-title">Welcome back.</h1>
        <p className="page-subtitle">
          Sign in with your verified email and password.
        </p>
        {p.verified && (
          <div className="success" role="status">
            Your email is verified. You can now sign in.
          </div>
        )}
        <AccountForm mode="login" />
      </div>
    </div>
  );
}
