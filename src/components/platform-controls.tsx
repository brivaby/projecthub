"use client";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { defaultRankingWeights, settingInput } from "@/lib/platform-settings";
import { api } from "./actions";
type Setting = z.infer<typeof settingInput>;
type SettingsState = {
  [K in Setting["key"]]: Extract<Setting, { key: K }>["value"];
};
type SettingKey = keyof SettingsState;
const initial: SettingsState = {
  rankingWeights: { ...defaultRankingWeights },
  recommendations: { enabled: true, personalization: true, diversity: true },
  moderation: { reviewNewProjects: false, allowPublicComments: true },
  retention: { analyticsDays: 90, sentEmailDays: 30, usedChallengeDays: 7 },
};
const labels: Record<string, string> = {
  views: "Unique-view weight",
  likes: "Endorsement weight",
  bookmarks: "Bookmark weight",
  comments: "Public-comment weight",
  clones: "Approved-clone weight",
  collaborations: "Approved-collaboration weight",
  decayDays: "Decay interval (days)",
  decayPower: "Decay strength",
  enabled: "Enable project recommendations",
  personalization: "Allow personalized recommendations",
  diversity: "Diversify recommended disciplines and creators",
  reviewNewProjects: "Require administrator review before new publication",
  allowPublicComments: "Allow public commenting, subject to project rules",
  analyticsDays: "Anonymous analytics retention (days)",
  sentEmailDays: "Sent-email event retention (days)",
  usedChallengeDays: "Used verification challenge retention (days)",
};
const titles: Record<SettingKey, string> = {
  rankingWeights: "Ranking weights",
  recommendations: "Recommendations",
  moderation: "Publication & comments",
  retention: "Data retention",
};
const descriptions: Record<SettingKey, string> = {
  rankingWeights:
    "Configure weighted engagement and time decay. Changes affect discovery rankings; each save enters the audit log.",
  recommendations:
    "Platform-wide controls complement each student’s personal privacy preferences.",
  moderation:
    "Project-level restrictions still apply. Turning on review sends new publication attempts to the moderation queue.",
  retention:
    "Configure retention periods. Run the documented retention worker regularly and confirm your backup policy separately; saving a period does not erase backups.",
};
export function PlatformControls() {
  const [values, setValues] = useState<SettingsState>(initial);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<SettingKey | null>(null);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Partial<Record<SettingKey, string>>>(
    {},
  );
  const [persisted, setPersisted] = useState<
    Partial<Record<SettingKey, boolean>>
  >({});
  const [dirty, setDirty] = useState<Partial<Record<SettingKey, boolean>>>({});
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = (await api("/api/admin/settings", "GET")) as {
        key: string;
        value: unknown;
      }[];
      const next: SettingsState = {
        rankingWeights: { ...initial.rankingWeights },
        recommendations: { ...initial.recommendations },
        moderation: { ...initial.moderation },
        retention: { ...initial.retention },
      };
      const saved: Partial<Record<SettingKey, boolean>> = {};
      const invalid: string[] = [];
      for (const row of rows) {
        const parsed = settingInput.safeParse(row);
        if (parsed.success) {
          const item = parsed.data;
          Object.assign(next, { [item.key]: item.value });
          saved[item.key] = true;
        } else if (row.key in initial) invalid.push(row.key);
      }
      setValues(next);
      setPersisted(saved);
      setDirty({});
      setMessages({});
      setReady(true);
      if (invalid.length)
        setError(
          `Stored settings need repair: ${invalid.join(", ")}. Safe defaults are shown; review them before saving.`,
        );
    } catch (e) {
      setReady(false);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function field<K extends SettingKey>(
    key: K,
    name: keyof SettingsState[K],
    value: number | boolean,
  ) {
    setValues((current) => ({
      ...current,
      [key]: { ...current[key], [name]: value },
    }));
    setDirty((current) => ({ ...current, [key]: true }));
    setMessages((current) => ({ ...current, [key]: "" }));
  }
  async function save(key: SettingKey) {
    setError("");
    setMessages((current) => ({ ...current, [key]: "" }));
    const parsed = settingInput.safeParse({ key, value: values[key] });
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(" · "),
      );
      return;
    }
    setPending(key);
    try {
      await api("/api/admin/settings", "POST", parsed.data);
      setPersisted((current) => ({ ...current, [key]: true }));
      setDirty((current) => ({ ...current, [key]: false }));
      setMessages((current) => ({
        ...current,
        [key]: "Configuration saved and recorded in the audit log.",
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  return (
    <section aria-labelledby="platform-controls-title">
      <h2
        id="platform-controls-title"
        className="page-title"
        style={{ fontSize: 30 }}
      >
        Platform controls
      </h2>
      <p className="page-subtitle">
        Administrator-only configuration. Each section is saved independently;
        displayed defaults are not persisted until you save them.
      </p>
      {loading && <p role="status">Loading platform configuration…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="text-button"
        disabled={loading || !!pending}
        onClick={() => void load()}
      >
        Reload saved configuration
      </button>
      {(Object.keys(titles) as SettingKey[]).map((key) => (
        <form
          className="panel"
          key={key}
          onSubmit={(event) => {
            event.preventDefault();
            void save(key);
          }}
          style={{ marginTop: 20 }}
        >
          <h3
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 25,
              fontWeight: 400,
              marginBottom: 12,
            }}
          >
            {titles[key]}
          </h3>
          <span className="status">
            {dirty[key]
              ? "UNSAVED CHANGES"
              : persisted[key]
                ? "SAVED CONFIGURATION"
                : "DEFAULT — NOT YET SAVED"}
          </span>
          <p className="page-subtitle" style={{ fontSize: 12, marginTop: 15 }}>
            {descriptions[key]}
          </p>
          <fieldset
            disabled={!ready || loading || !!pending}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <legend className="sr-only">
              {titles[key]} configuration fields
            </legend>
            <div className="form-grid">
              {Object.entries(values[key]).map(([name, value]) =>
                typeof value === "boolean" ? (
                  <label className="check-field span-2" key={name}>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        field(
                          key,
                          name as keyof SettingsState[typeof key],
                          event.target.checked,
                        )
                      }
                    />
                    {labels[name] || name}
                  </label>
                ) : (
                  <label className="field" key={name}>
                    {labels[name] || name}
                    <input
                      type="number"
                      required
                      value={Number.isFinite(value) ? value : ""}
                      min={
                        name === "decayPower"
                          ? 0.1
                          : name === "decayDays" || key === "retention"
                            ? 1
                            : 0
                      }
                      max={
                        name === "decayDays"
                          ? 365
                          : name === "decayPower"
                            ? 5
                            : name === "analyticsDays"
                              ? 730
                              : name === "sentEmailDays"
                                ? 365
                                : name === "usedChallengeDays"
                                  ? 90
                                  : 100
                      }
                      step={
                        key === "retention" || name === "decayDays" ? 1 : 0.1
                      }
                      onChange={(event) =>
                        field(
                          key,
                          name as keyof SettingsState[typeof key],
                          event.target.value === ""
                            ? Number.NaN
                            : Number(event.target.value),
                        )
                      }
                    />
                  </label>
                ),
              )}
            </div>
            <div className="form-actions">
              <button className="button" disabled={!ready || !!pending}>
                {pending === key
                  ? "Saving…"
                  : `Save ${titles[key].toLowerCase()}`}
              </button>
              {messages[key] && <span role="status">{messages[key]}</span>}
            </div>
          </fieldset>
        </form>
      ))}
    </section>
  );
}
