import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Relative, forward-slash path resolved from this config's directory.
  // Avoids absolute Windows backslash paths, which drizzle-kit's glob
  // matcher fails to resolve. Works identically on Linux/Replit.
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
