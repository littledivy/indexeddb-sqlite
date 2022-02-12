// Maybe use divy's async_sqlite?
import { Database as SqliteDatabase } from "https://deno.land/x/sqlite3@0.3.1/mod.ts";

class IndexedDBRequest {
  constructor() {
    
  }
}

class IDBKeyRange {
  get lower() {}
  get upper() {}
  get lowerOpen() {}
  get upperOpen() {}

  static only(value) {}
  static lowerBound(lower, open = false) {}
  static upperBound(upper, open = false) {}
  static bound(lower, upper, lowerOpen = false, upperOpen = false) {}
  includes(key) {}
}

const _queue = Symbol("[[idb_queue]]");
class IndexedDBTransaction {
  #stores; // : string[];
  #mode; // : string;
  #db; // : IndexedDBDatabase;
  #queue = [];

  constructor(db, storeNames, mode) {
    this.#stores = storeNames;
    this.#mode = mode;
    this.#db = db;
  }
  
  get objectStoreNames() {
    return this.#stores;
  }
  get mode() {}
  get durability() {}
  get db() {}
  get error() {}

  objectStore(name) {
    const maybeStore = this.#db.objectStore[name];
    if (maybeStore === undefined) {
      throw new TypeError("Object store not found");
    }
    return maybeStore;
  }
  
  commit() {}
  abort() {}

  [_queue](cb) {
    // Fuck the queue for now.
    cb(this.#db);
  }
}
  
class IndexedDBStore {
  #name; // : string;
  #tx; // : IndexedDBTransaction;

  constructor(name, tx) {
    this.#name = name;
    this.#tx = tx;
  }
  
  get name() { 
    return this.#name;
  }

  get keyPath() {}
  get indexNames() {}
  get transaction() {
    return this.#tx;
  }
  get autoIncrement() {}

  put(value, key) {}
  add(value, key) {}
  delete(query) {}
  clear() {}

  get(key) {
    this.#tx[_queue](db => {
      // FIXME!
      db.execute(`
        SELECT value FROM ${this.#name} WHERE LIMIT = 1;
      `);
    })
  }

  getKey(query) {}
  getAll(query, count) {}
  getAllKey(query, count) {}
  openCursor(query, direction = "next") {}
  openKeyCursor(query, direction = "next") {}
  createIndex(name, keyPath, options = {}) {}
  index(name) {}
  deleteIndex(name) {}
  count(query) {}
}

class IndexedDBDatabase {
  #backend; // : SqliteDatabase;
  #objectStores = {}; // : Record<string, IndexDBStore>[];
  constructor(backend) {
    this.#backend = backend;
  }
  
  get name() {}
  get version() {}

  createObjectStore(name, options) {
    const store = new IndexedDBStore(name);
    this.#objectStores[name] = store;
    
    // FIXME!
    this.#backend.execute(`
      CREATE TABLE ${name} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key BLOB UNIQUE,
        value BLOB
      );
    `);
    // TODO: Insert store into the schema table
  }

  deleteObjectStore(name) {
    delete this.#objectStores[name];
    
    // FIXME!
    this.#backend.execute(`
      DROP TABLE ${name}
    `);
    // TODO: Delete from schema table
  }

  transaction(storeNames, mode = "readonly", options) {
    for (var i = 0; i < storeNames.length; i++) {
      if (!Object.keys(this.#objectStore).contains(storeNames[i])) throw new TypeError("Not found");
    }

    return new IndexedDBTransaction(this, storeNames, mode);
  }

  close() {
    this.#backend.close();
  }
}

class Factory {
  // name: string, version?: number
  open(name, version) {
    const database = new SqliteDatabase(name);
    // TODO: Skipped a lot of stuff
    // Make a schema table?
    return new IndexedDBDatabase(database);
  }

  deleteDatabase(name) {}
  async databases() {}
  cmp(first, second) {}
}

window.indexedDB = new Factory();