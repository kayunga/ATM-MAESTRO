import { readFileSync } from "node:fs";
import { pool } from "../server/db.js";
await pool.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("Schema is up to date.");
await pool.end();
