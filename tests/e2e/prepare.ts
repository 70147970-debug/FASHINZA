import "dotenv/config";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { E2E_DATABASE_URL, E2E_ENV } from "./env";

/**
 * Prepares the disposable e2e database before Playwright starts the server: applies migrations,
 * empties every table and re-seeds it. Refuses to run unless the database name contains "e2e".
 */
function prepare() {
  if (!E2E_DATABASE_URL || !/e2e/i.test(new URL(E2E_DATABASE_URL).pathname)) {
    throw new Error("Set E2E_DATABASE_URL to a disposable database whose name contains 'e2e'.");
  }
  rmSync(E2E_ENV.UPLOAD_DIR, { recursive: true, force: true });
  const env = { ...process.env, ...E2E_ENV };
  execSync("npx prisma migrate deploy", { stdio: "pipe", env });
  const sql = `DO $$ DECLARE t text; BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
      EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
    END LOOP; END $$;`;
  execSync("npx prisma db execute --stdin", { input: sql, stdio: ["pipe", "pipe", "pipe"], env: { ...env, DATABASE_URL: E2E_DATABASE_URL } });
  execSync("npx prisma db seed", { stdio: "pipe", env });
}

prepare();
console.log("e2e database prepared and seeded");
