import { AccountForm } from "@/components/account-form";
export const metadata = { title: "Create your Vic Academy ProjectHub account" };
export default function Register() {
  return (
    <div className="container page">
      <div className="form-card" style={{ maxWidth: 650 }}>
        <span className="eyebrow">IDEAS START HERE</span>
        <h1 className="page-title">Join the community.</h1>
        <p className="page-subtitle">
          Everyone can discover and support student work. Publishing and
          collaboration require a verified Vic Academy address.
        </p>
        <AccountForm mode="register" />
      </div>
    </div>
  );
}
