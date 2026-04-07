import { db } from "@workspace/db";
import { enabledLocales } from "@workspace/db/schema";
import { logger } from "./logger";

const DEFAULT_LOCALES = [
  { code: "en", name: "English", flag: "🇬🇧", enabled: true, isDefault: true },
  { code: "pl", name: "Polski", flag: "🇵🇱", enabled: true, isDefault: false },
  { code: "cs", name: "Čeština", flag: "🇨🇿", enabled: true, isDefault: false },
  { code: "de", name: "Deutsch", flag: "🇩🇪", enabled: true, isDefault: false },
  { code: "fr", name: "Français", flag: "🇫🇷", enabled: true, isDefault: false },
];

export async function seedDefaultLocales() {
  const existing = await db.select().from(enabledLocales);
  if (existing.length > 0) return;

  await db.insert(enabledLocales).values(DEFAULT_LOCALES);
  logger.info("Auto-seeded enabled_locales with 5 default locales");
}
