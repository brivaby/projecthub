import { actor } from "@/lib/security";
import { redirect } from "next/navigation";
import { AccountSecurity } from "@/components/account-form";
export const metadata = { title: "Account security" };
export default async function Account() {
  try {
    await actor();
  } catch {
    redirect("/login");
  }
  return (
    <div className="container page" style={{ maxWidth: 850 }}>
      <h1 className="page-title">Your account, protected.</h1>
      <p className="page-subtitle">
        Manage your password, verified email, devices, and collaboration
        consent.
      </p>
      <AccountSecurity />
    </div>
  );
}
