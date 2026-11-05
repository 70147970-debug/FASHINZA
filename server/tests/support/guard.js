/**
 * Database guard for automated tests: the database name must contain "test" (or "e2e" for the e2e suite)
 * and must differ from the application's MONGODB_URI. Tests wipe every collection.
 */
export const DEFAULT_TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/fashinza_test?replicaSet=rs0";

/** Database name from a mongodb:// or mongodb+srv:// URI ("" when absent). */
const URI = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)\/?([^?]*)/;

export function databaseName(uri) {
  const m = URI.exec(String(uri));
  if (!m) throw new Error("Invalid MongoDB URI.");
  return decodeURIComponent(m[2]);
}

/** Host list of a MongoDB URI (credentials removed). */
export function hostsOf(uri) {
  const m = URI.exec(String(uri));
  if (!m) throw new Error("Invalid MongoDB URI.");
  return m[1].toLowerCase();
}

/**
 * @param {string} uri
 * @param {string | undefined} appUri the application's MONGODB_URI (must not be the same database)
 * @param {RegExp} [pattern]
 */
export function assertTestDatabaseUri(uri, appUri, pattern = /test/i) {
  let name;
  try {
    name = databaseName(uri);
  } catch {
    throw new Error("TEST_MONGODB_URI is not a valid MongoDB connection string.");
  }
  if (!name || !pattern.test(name)) {
    throw new Error(`Refusing to run: the test database name must contain "${pattern.source}" (got "${name || "(none)"}").`);
  }
  if (appUri) {
    let same = false;
    try {
      same = databaseName(appUri) === name && hostsOf(appUri) === hostsOf(uri);
    } catch {
      same = false;
    }
    if (same) throw new Error("Refusing to run: TEST_MONGODB_URI must point to a separate database, not the application's MONGODB_URI.");
  }
  return name;
}
