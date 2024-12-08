import { openDB } from "idb";

const DB_NAME = "flux-image-generator";
const STORE_NAME = "state";

export const getDb = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
};

interface State {
  // Define the properties of the state object here
  [key: string]: unknown;
}

export const saveState = async (state: State) => {
  const db = await getDb();
  await db.put(STORE_NAME, { id: "user-settings", ...state });
};

export const getApiKey = async () => {
  const db = await getDb();
  const state = await db.get(STORE_NAME, "user-api-key");
  return state?.api_key;
};

export const setApiKey = async (apiKey: string) => {
  const db = await getDb();
  await db.put(STORE_NAME, { id: "user-api-key", api_key: apiKey });
};

export const getState = async () => {
  const db = await getDb();
  return db.get(STORE_NAME, "user-settings");
};

export const clearState = async () => {
  const db = await getDb();
  await db.delete(STORE_NAME, "user-settings");
};
