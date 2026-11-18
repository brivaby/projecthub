import { actor } from "@/lib/security";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { NotificationPreferences,BlockedUsers } from "@/components/notification-preferences";
import { SettingsForm } from "@/components/settings-form";
import { signOut } from "@/auth";
export default async function Settings() {
  let u;
  try {
    u = await actor();
  } catch {
    redirect("/login");
  }
  const user = await db.user.findUniqueOrThrow({
    where: { id: u.id },
    select: {
      name: true,
      emailNotifications: true,
      inAppNotifications: true,
      profile: true,
    },
  });
  return (
    <div className="container page">
      <h1 className="page-title">Make yourself at home.</h1>
      <p className="page-subtitle">
        Your public profile, privacy, and notification preferences.
      </p>
      <SettingsForm user={user} /><div style={{maxWidth:850,margin:"25px auto"}}><NotificationPreferences/><BlockedUsers/></div>
      <form
        style={{ maxWidth: 850, margin: "25px auto" }}
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="button secondary">Sign out</button>
      </form>
    </div>
  );
}
