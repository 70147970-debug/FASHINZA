import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { config, loadEnvFiles, redactUri } from "../../src/config.js";
import { assertTestDatabaseUri, databaseName } from "../support/guard.js";

describe("config", () => {
  it("lets server/.env override the root .env, and the real environment override both", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fz-env-"));
    const root = path.join(dir, "root.env");
    const server = path.join(dir, "server.env");
    fs.writeFileSync(root, "A=root\nB=root\nC=root\n");
    fs.writeFileSync(server, "B=server\nC=server\n");
    const env = { C: "process" };
    loadEnvFiles(env, [root, server, path.join(dir, "missing.env")]);
    expect(env).toEqual({ A: "root", B: "server", C: "process" });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("defaults to port 4000 and the rs0 replica set", () => {
    expect(config.port).toBe(Number(process.env.PORT) || 4000);
    expect(config.mongodbUri).toContain("replicaSet=rs0");
    expect(config.isProduction).toBe(false);
  });

  it("redacts credentials from MongoDB URIs", () => {
    expect(redactUri("mongodb://user:secret@db.example:27017/fashinza?replicaSet=rs0")).not.toContain("secret");
  });
});

describe("test database guard", () => {
  it("only accepts database names containing 'test'", () => {
    expect(assertTestDatabaseUri("mongodb://127.0.0.1:27017/fashinza_test?replicaSet=rs0")).toBe("fashinza_test");
    expect(() => assertTestDatabaseUri("mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0")).toThrow(/Refusing/);
    expect(() => assertTestDatabaseUri("mongodb://127.0.0.1:27017/?replicaSet=rs0")).toThrow(/Refusing/);
    expect(() => assertTestDatabaseUri("mongodb://h1:1,h2:2/fashinza_e2e", undefined, /e2e/)).not.toThrow();
  });

  it("refuses the application's own database", () => {
    const uri = "mongodb://127.0.0.1:27017/fashinza_test";
    expect(() => assertTestDatabaseUri(uri, "mongodb://127.0.0.1:27017/fashinza_test?replicaSet=rs0")).toThrow(/separate database/);
    expect(() => assertTestDatabaseUri(uri, "mongodb://127.0.0.1:27017/fashinza")).not.toThrow();
  });

  it("parses database names from multi-host and credentialed URIs", () => {
    expect(databaseName("mongodb://u:p@a:1,b:2/fashinza_test?replicaSet=rs0")).toBe("fashinza_test");
    expect(databaseName("mongodb+srv://cluster.example/fz_test")).toBe("fz_test");
  });
});
