import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const consentConfig = pgTable("consent_config", {
  id: serial("id").primaryKey(),
  bannerTitle: varchar("banner_title", { length: 200 }).default("We value your privacy"),
  bannerText: text("banner_text").default(
    'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.'
  ),
  privacyPolicyUrl: varchar("privacy_policy_url", { length: 500 }).default("/privacy"),
  acceptAllLabel: varchar("accept_all_label", { length: 50 }).default("Accept All"),
  rejectAllLabel: varchar("reject_all_label", { length: 50 }).default("Reject All"),
  customizeLabel: varchar("customize_label", { length: 50 }).default("Customize"),
  savePrefsLabel: varchar("save_prefs_label", { length: 50 }).default("Save Preferences"),
  necessaryLabel: varchar("necessary_label", { length: 100 }).default("Strictly Necessary"),
  necessaryDesc: text("necessary_desc").default("These cookies are essential for the website to function properly. They enable core functionality such as security, network management, and account access."),
  analyticsLabel: varchar("analytics_label", { length: 100 }).default("Analytics"),
  analyticsDesc: text("analytics_desc").default("These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously."),
  marketingLabel: varchar("marketing_label", { length: 100 }).default("Marketing"),
  marketingDesc: text("marketing_desc").default("These cookies are used to track visitors across websites. The intention is to display ads that are relevant and engaging for the individual user."),
  preferencesLabel: varchar("preferences_label", { length: 100 }).default("Preferences"),
  preferencesDesc: text("preferences_desc").default("These cookies enable the website to provide enhanced functionality and personalization, such as remembering your language preference or region."),
  updatedAt: timestamp("updated_at").defaultNow(),
});
