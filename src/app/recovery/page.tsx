import { AccountForm } from "@/components/account-form";
export const metadata = { title: "Reset your password" };
export default function Recovery() {
  return (
    <div className="container page">
      <div className="panel" style={{ maxWidth: 550, margin: "25px auto" }}>
        <h1 className="page-title">Find your way back.</h1>
        <p className="page-subtitle">
          Request a six-digit reset code, then choose a new password. Resetting
          your password signs out your existing devices.
        </p>
        <AccountForm mode="recovery" purpose="RESET" />
      </div>
    </div>
  );
}
