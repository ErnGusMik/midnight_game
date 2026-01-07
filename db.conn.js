import { JsonDB, Config } from "node-json-db";

const db = new JsonDB(new Config("midnightGameDB", true, false, '/'));

export default db;