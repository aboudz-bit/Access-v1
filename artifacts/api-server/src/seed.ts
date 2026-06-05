import {
  db,
  pool,
  usersTable,
  languagesTable,
  interpreterLanguagesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { hashPassword } from "./lib/auth";

const LANGUAGES: {
  code: string;
  name: string;
  nameAr: string;
  flagEmoji: string;
}[] = [
  { code: "ar", name: "Arabic", nameAr: "العربية", flagEmoji: "🇸🇦" },
  { code: "en", name: "English", nameAr: "الإنجليزية", flagEmoji: "🇬🇧" },
  { code: "fr", name: "French", nameAr: "الفرنسية", flagEmoji: "🇫🇷" },
  { code: "es", name: "Spanish", nameAr: "الإسبانية", flagEmoji: "🇪🇸" },
  { code: "de", name: "German", nameAr: "الألمانية", flagEmoji: "🇩🇪" },
  { code: "tr", name: "Turkish", nameAr: "التركية", flagEmoji: "🇹🇷" },
  { code: "ur", name: "Urdu", nameAr: "الأردية", flagEmoji: "🇵🇰" },
  { code: "hi", name: "Hindi", nameAr: "الهندية", flagEmoji: "🇮🇳" },
  { code: "zh", name: "Chinese", nameAr: "الصينية", flagEmoji: "🇨🇳" },
  { code: "ru", name: "Russian", nameAr: "الروسية", flagEmoji: "🇷🇺" },
  { code: "fa", name: "Persian", nameAr: "الفارسية", flagEmoji: "🇮🇷" },
  { code: "fil", name: "Filipino", nameAr: "الفلبينية", flagEmoji: "🇵🇭" },
];

const ACCOUNTS: {
  email: string;
  name: string;
  password: string;
  role: string;
  status: string;
}[] = [
  {
    email: "admin@access.app",
    name: "Admin",
    password: "Admin123",
    role: "admin",
    status: "offline",
  },
  {
    email: "user@access.app",
    name: "Demo User",
    password: "User123",
    role: "user",
    status: "offline",
  },
  {
    email: "interpreter@access.app",
    name: "Demo Interpreter",
    password: "Inter123",
    role: "interpreter",
    status: "available",
  },
];

const INTERPRETER_LANGUAGE_CODES = ["ar", "en", "fr"];

async function seed() {
  if (
    process.env["NODE_ENV"] === "production" &&
    process.env["ALLOW_PROD_SEED"] !== "true"
  ) {
    throw new Error(
      "Refusing to seed in production. Set ALLOW_PROD_SEED=true to override.",
    );
  }
  console.log("Seeding languages...");
  for (const lang of LANGUAGES) {
    await db.insert(languagesTable).values(lang).onConflictDoNothing({
      target: languagesTable.code,
    });
  }

  console.log("Seeding demo accounts...");
  for (const acct of ACCOUNTS) {
    await db
      .insert(usersTable)
      .values({
        email: acct.email,
        name: acct.name,
        passwordHash: hashPassword(acct.password),
        role: acct.role,
        status: acct.status,
      })
      .onConflictDoNothing({ target: usersTable.email });
  }

  const [interpreter] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "interpreter@access.app"))
    .limit(1);

  if (interpreter) {
    const langs = await db
      .select()
      .from(languagesTable)
      .where(inArray(languagesTable.code, INTERPRETER_LANGUAGE_CODES));
    await db
      .delete(interpreterLanguagesTable)
      .where(eq(interpreterLanguagesTable.interpreterId, interpreter.id));
    if (langs.length > 0) {
      await db.insert(interpreterLanguagesTable).values(
        langs.map((l) => ({
          interpreterId: interpreter.id,
          languageId: l.id,
        })),
      );
    }
    console.log(
      `Assigned ${langs.length} languages to demo interpreter (#${interpreter.id}).`,
    );
  }

  console.log("Seed complete.");
  console.log("Demo accounts:");
  for (const a of ACCOUNTS) {
    console.log(`  ${a.role.padEnd(12)} ${a.email} / ${a.password}`);
  }
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
