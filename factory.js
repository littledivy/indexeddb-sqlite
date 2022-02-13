// Maybe use divy's async_sqlite?
import { Database as SqliteDatabase } from "https://deno.land/x/sqlite3@0.3.1/mod.ts";

const _source = Symbol("[[IDBRequest.source]]");
const _tx = Symbol("[[IDBRequest.transaction]]");
const _result = Symbol("[[IDBRequest.result]]");
const _readyState = Symbol("[[IDBRequest.readyState]]");
const _error = Symbol("[[IDBRequest.error]]");

// Record<string, IDBRequest>;
const connectionQueue = {};

class IDBRequest extends EventTarget {
  [_source];
  [_tx];
  [_result];
  [_readyState] = "pending";
  [_error];
  onsuccess;
  onerror;

  get result() {
    return this[_result];
  }

  get error() {
    return this[_error];
  }

  get source() {
    return this[_source];
  }

  get transaction() {
    return this[_tx];
  }

  get readyState() {
    return this[_readyState];
  }

  toString() {
    return "[object IDBRequest]";
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

class IDBIndex {
  get name() {}
  get objectStore() {}
  get keyPath() {}
  get multiEntry() {}
  get unique() {}

  get(query) {}
  getKey(query) {}
  getAll(query) {}
  getAllKeys(query) {}
  count(query) {}
  openCursor(query, direction = "next") {}
  openKeyCursor(query, direction = "next") {}
}

const _storeTx = Symbol("[[IDBStore.transaction]]");
const _storeName = Symbol("[[IDBStore.name]]");

class IDBStore {
  [_storeName]; // : string;
  [_storeTx]; // : IDBTransaction;

  constructor(name, tx) {
    this[_storeName] = name;
    this[_storeTx] = tx;
  }

  get name() {
    return this[_storeName];
  }

  get keyPath() {}
  get indexNames() {}
  get transaction() {
    return this[_storeTx];
  }
  get autoIncrement() {}

  put(value, key) {}
  add(value, key) {}
  delete(query) {}
  clear() {}

  get(key) {
    this[_storeTx][_queue]((db) => {
      // FIXME!
      db.execute(`
        SELECT value FROM ${this.#name} WHERE LIMIT = 1;
      `);
    });
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

class IDBDatabase extends EventTarget {
  #backend; // : SqliteDatabase;
  #objectStores = {}; // : Record<string, IndexDBStore>[];
  onabort;
  onclose;
  onerror;
  onversionchange;

  constructor(backend) {
    this.#backend = backend;
  }

  // https://w3c.github.io/IndexedDB/#dom-idbdatabase-objectstorenames
  get objectStoreNames() {
    return Object.keys(this.#objectStores).sort();
  }

  get name() {}
  get version() {}

  // https://w3c.github.io/IndexedDB/#dom-idbdatabase-createobjectstore
  createObjectStore(name, options) {
    // 4.
    const keyPath = options.keyPath || null;
    if (keyPath !== null) {
      validateKeyPath(keyPath);
    }
    if (this.#objectStores[name] !== undefined) {
      // TODO: ConstraintError
      throw new TypeError("Object store already exists");
    }
    const autoIncrement = options.autoIncrement || false;
    if (autoIncrement && (keyPath == "" || Array.isArray(keyPath))) {
      // TODO: InvalidAccessError
      throw new TypeError();
    }

    const store = Object.create(IDBStore);
    store[_storeName] = name;
    // TODO
    // store[_storeTx] = transaction;
    this.#objectStores[name] = store;
    // FIXME!
    // Backends will be asyncronous so we need to store this
    // promise in the returned IDBStore object. In case this fails
    // the spec wants us to fire an event using "abort a transaction" steps.
    this.#backend.execute(`
      CREATE TABLE ${name} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key BLOB UNIQUE,
        value BLOB
      );
    `);
    // TODO: Insert store into the schema table
    return store;
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
      if (!Object.keys(this.#objectStore).contains(storeNames[i])) {
        throw new TypeError("Not found");
      }
    }

    return new IndexedDBTransaction(this, storeNames, mode);
  }

  close() {
    this.#backend.close();
  }
}

class IDBOpenDBRequest extends IDBRequest {
  onupgradeneeded;
  onblocked;

  toString() {
    return "[object IDBOpenDBRequest]";
  }
}

// https://w3c.github.io/IndexedDB/#factory-interface
class IDBFactory {
  // https://w3c.github.io/IndexedDB/#dom-idbfactory-open
  // name: string, version?: number
  open(name, version) {
    if (version == 0) throw new TypeError("Version cannot be 0.");

    // https://w3c.github.io/IndexedDB/#request-open-request
    const request = Object.create(IDBOpenDBRequest);
    // source of an open request is always null.
    request[_source] = null;
    openDatabase(name, version, request).then((result) => {
      request[_result] = result;
      request[_readyState] = "done";
      // dispatchEvent
    }).catch((err) => {
      request[_result] = undefined;
      request[_readyState] = "done";
      request[_error] = err;
      // dispatchEvent
    });

    return request;
  }

  // https://w3c.github.io/IndexedDB/#dom-idbfactory-deletedatabase
  deleteDatabase(name) {
    // https://w3c.github.io/IndexedDB/#request-open-request
    const request = Object.create(IDBOpenDBRequest);
    // source of an open request is always null.
    request[_source] = null;
    backend.deleteDatabase(name, request).then((result) => {
      request[_result] = result;
      request[_readyState] = "done";
      // dispatchEvent
    }).catch((err) => {
      request[_result] = undefined;
      request[_readyState] = "done";
      request[_error] = err;
      // dispatchEvent
    });

    return request;
  }

  // https://w3c.github.io/IndexedDB/#dom-idbfactory-databases
  async databases() {
    // { name: string; version: number }[]
    return backend.listDatabases();
  }

  // https://w3c.github.io/IndexedDB/#dom-idbfactory-cmp
  cmp(first, second) {
    // 1-2.
    const a = convertValueToKey(first);
    if (a === "invalid") throw new DOMException("Invalid value", "DataError");
    // 3-4.
    const b = convertValueToKey(second);
    if (b === "invalid") throw new DOMException("Invalid value", "DataError");
    // 5.
    return compareKeys(a, b);
  }

  toString() {
    return "[object IDBFactory]";
  }
}

// https://tc39.es/ecma262/#prod-IdentifierName
const regexIdentifierName =
  /^(?:[$_\p{ID_Start}])(?:[$_\u200C\u200D\p{ID_Continue}])*$/u;

// https://w3c.github.io/IndexedDB/#key-path
function validateKeyPath(keyPath) {
  if (typeof keyPath == "string") {
    if (keyPath === "") return;
    if (regexIdentifierName.test(keyPath)) return;
    // Seperated by U+002E FULL STOP.
    if (keyPath.indexOf(".") >= 0) {
      const paths = keyPath.split(".");
      for (const path of paths) {
        if (!regexIdentifierName.test(path)) {
          throw new SyntaxError("Not a valid key path");
        }
      }
      return;
    }
    throw new SyntaxError("Not a valid key path");
  }
  if (Array.isArray(keyPath) && keyPath.length > 0) {
    for (const path of keyPath) {
      validateKeyPath(path);
    }
    return;
  }
  throw new SyntaxError("Not a valid key path");
}

// https://w3c.github.io/IndexedDB/#compare-two-keys
function compareKeys(a, b) {
  // 1-2.
  const ta = a.type;
  const tb = b.type;
  // 3.
  if (ta !== tb) {
    if (ta === "array") return 1;
    if (tb === "array") return -1;

    if (ta === "binary") return 1;
    if (tb === "binary") return -1;

    if (ta === "string") return 1;
    if (tb === "string") return -1;

    if (ta === "date") return 1;
    if (tb !== "date") {
      throw new TypeError("unreachable");
    }

    return -1;
  }
  // 4-5.
  const va = a.value;
  const vb = b.value;
  // 6.
  switch (ta) {
    case "number":
    case "date": {
      if (va > vb) return 1;
      if (vb > va) return -1;
      return 0;
    }
    case "string": {
      // a code unit less b is just the same as a < b
      if (va < vb) return -1;
      if (vb < va) return 1;
      return 0;
    }
    case "binary": {
      // TODO
    }
    case "array": {
      const length = Math.min(va.length, vb.length);
      let i = 0;
      while (i < length) {
        const result = cmp(va[i], vb[i]);
        if (result !== 0) {
          return result;
        }
        i++;
      }
      if (va.length > vb.length) {
        return 1;
      }
      if (va.length < vb.length) {
        return -1;
      }
      return 0;
    }
    // TODO(@littledivy): This should be in the spec as an `ASSERT:`?
    default:
      throw new TypeError("unreachable");
  }
}

// https://w3c.github.io/IndexedDB/#convert-a-value-to-a-key
function convertValueToKey(input, seen) {
  // 1.
  if (seen === undefined) seen = new Set();
  // 2.
  if (seen.has(input)) {
    return "invalid";
  }

  // 3.1
  if (typeof input === "number") {
    if (isNaN(input)) {
      throw new DOMException("input is NaN", "DataError");
    }
    return { type: "number", value: input };
  }
  // 3.2
  if (input instanceof Date) {
    const ms = input.valueOf();
    if (isNaN(ms)) {
      throw new DataError();
    }
    return { type: "date", value: input };
  }
  // 3.3
  if (typeof input === "string") {
    return { type: "string", value: input };
  }
  // 3.4
  if (
    input instanceof ArrayBuffer ||
    ArrayBuffer.isView(input)
  ) {
    // TODO(@littledivy): Copy bytes
    return { type: "binary", value: input };
  }
  // 3.5
  if (Array.isArray(input)) {
    // 3.5.1
    const len = input.length;
    seen.add(input);
    const keys = [];
    let index = 0;
    // 3.5.5
    while (index < len) {
      // 3.5.5.1
      const hop = input.hasOwnProperty(index);
      if (hop === false) {
        return "invalid";
      }

      const entry = input[i];
      const key = convertValueToKey(entry, seen);
      if (key === "invalid") return "invalid";
      keys.push(key);
      // 3.5.5.7
      index += 1;
    }
    // 3.5.6
    return keys;
  }
  // 3.6
  return "invalid";
}

async function openDatabase(name, version, request) {
  // TODO(@littledivy): Skipped a lot of stuff
  // Make and use a schema table.

  if (connectionQueue[name]) {
    connectionQueue[name] = [];
  }

  const queue = connectionQueue[name];
  queue.push(request);

  await Promise.all(queue);
  // TODO(@littledivy): versioning
  return new IDBDatabase(backend.openDatabase(name));
}

const backend = {
  async openDatabase(name) {
    const database = new SqliteDatabase(name);
    return database;
  },
  async deleteDatabase(name, request) {},
  async listDatabases() {},
};

window.indexedDB = new IDBFactory();
