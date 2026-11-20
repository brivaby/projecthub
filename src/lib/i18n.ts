// Central formatting boundary: locale/timezone are explicit and can later come from user preferences.
export const defaultLocale = "en-UG";
export const defaultTimeZone = "Africa/Kampala";
export const policyVersion = "2026-11-17";
export function formatDate(
  value: Date | string,
  locale = defaultLocale,
  timeZone = defaultTimeZone,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone,
  }).format(new Date(value));
}
export function formatDateTime(
  value: Date | string,
  locale = defaultLocale,
  timeZone = defaultTimeZone,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
export const messages = {
  en: {
    collaborationRestricted:
      "Collaboration is currently limited to verified Vine Iternational Christian Academy email accounts.",
    invalidForm: "Please check the form fields.",
    saved: "Your changes have been saved.",
  },
};
