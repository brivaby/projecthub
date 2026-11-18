"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./actions";
type Settings = {
  name: string | null;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  profile: {
    bio: string;
    institution: string;
    interests: string[];
    skills: string[];
    technologies: string[];
    links: string[];
    public: boolean;
    showInstitution: boolean;
    showDomainBadge: boolean;
    showCollaborations: boolean;
    showAvailability: boolean;
    showInRankings: boolean;
    personalizedRecommendations: boolean;
  } | null;
};
export function SettingsForm({ user }: { user: Settings }) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  const p = user.profile;
  return (
    <>
      <form
        className="form-card"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const text = (key: string) => String(f.get(key) || "");
          const list = (key: string) =>
            text(key)
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
          try {
            await api("/api/profile", "PATCH", {
              name: text("name"),
              bio: text("bio"),
              institution: text("institution"),
              interests: list("interests"),
              skills: list("skills"),
              technologies: list("technologies"),
              links: text("links")
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
              public: f.has("public"),
              showInstitution: f.has("showInstitution"),
              showDomainBadge: f.has("showDomainBadge"),
              showCollaborations: f.has("showCollaborations"),
              showAvailability: f.has("showAvailability"),
              showInRankings: f.has("showInRankings"),
              personalizedRecommendations: f.has("personalizedRecommendations"),
              emailNotifications: f.has("emailNotifications"),
              inAppNotifications: f.has("inAppNotifications"),
            });
            setMessage("Your profile has been updated");
            router.refresh();
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            Display name
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={user.name || ""}
            />
          </label>
          <label className="field">
            Institution
            <input
              name="institution"
              maxLength={160}
              defaultValue={p?.institution}
            />
          </label>
          <label className="field span-2">
            A little about you
            <textarea name="bio" maxLength={2000} defaultValue={p?.bio} />
          </label>
          {[
            ["interests", "Academic interests"],
            ["skills", "Skills"],
            ["technologies", "Technologies"],
          ].map(([name, label]) => (
            <label className="field" key={name}>
              {label}
              <input
                name={name}
                defaultValue={(
                  p?.[name as "interests" | "skills" | "technologies"] || []
                ).join(", ")}
              />
              <small>Separate with commas</small>
            </label>
          ))}
          <label className="field span-2">
            Public social links
            <textarea name="links" defaultValue={p?.links.join("\n")} />
            <small>
              One HTTPS URL per line. Never add private information.
            </small>
          </label>
          <label className="check-field span-2">
            <input
              name="public"
              type="checkbox"
              defaultChecked={p?.public ?? true}
            />
            Make my profile public
          </label>
          {(
            [
              ["showInstitution", "Show my institution on my public profile"],
              ["showDomainBadge", "Show my verified Vic Academy badge"],
              [
                "showCollaborations",
                "Display my approved public collaborations",
              ],
              ["showAvailability", "Show my collaboration availability"],
              ["showInRankings", "Include me in public contributor rankings"],
              [
                "personalizedRecommendations",
                "Personalize recommendations using my interests, saves and viewed projects",
              ],
            ] as const
          ).map(([name, label]) => (
            <label className="check-field span-2" key={name}>
              <input
                type="checkbox"
                name={name}
                defaultChecked={
                  p?.[name] ?? name === "personalizedRecommendations"
                }
              />
              {label}
            </label>
          ))}
          <label className="check-field span-2">
            <input
              name="emailNotifications"
              type="checkbox"
              defaultChecked={user.emailNotifications}
            />
            Email me about requests and project activity
          </label>
          <label className="check-field span-2">
            <input
              name="inAppNotifications"
              type="checkbox"
              defaultChecked={user.inAppNotifications}
            />
            Enable in-app notifications
          </label>
        </div>
        <div className="form-actions">
          <button className="button">Save profile</button>
          <span role="status">{message}</span>
        </div>
      </form>
      <div className="form-card" style={{ marginTop: 25 }}>
        <h2 className="page-title" style={{ fontSize: 27 }}>
          Your data, your choice.
        </h2>
        <p className="page-subtitle">
          Export your account data or delete your account. Deletion removes your
          profile. Team projects with another active owner are preserved; solo
          projects are archived.
        </p>
        <div className="form-actions">
          <a href="/account" className="button secondary">
            Password, email & sessions
          </a>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await api("/api/discovery", "POST", {
                  action: "CLEAR_HISTORY",
                });
                setMessage("Recommendation history cleared");
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Clear recommendation history
          </button>
          <a href="/api/profile" className="button secondary">
            Export my data
          </a>
          <button
            className="text-button"
            onClick={async () => {
              if (
                !confirm(
                  "Delete your account? This signs you out and removes your profile. Team projects are preserved for co-owners; solo projects are archived. This cannot be undone.",
                )
              )
                return;
              try {
                await api("/api/profile", "DELETE");
                window.location.href = "/";
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Delete account
          </button>
        </div>
      </div>
    </>
  );
}
