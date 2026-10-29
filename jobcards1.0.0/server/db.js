import pg from "pg";
// pg returns bigint as string by default; ids here are small enough for JS numbers.
pg.types.setTypeParser(20, (v) => Number(v));
const url = process.env.DATABASE_URL;
const local = !url || /localhost|127\.0\.0\.1/.test(url);
// Serverless: keep the pool tiny, one connection per function instance.
const g = globalThis;
export const pool = g.__pool ||= new pg.Pool({
  connectionString: url,
  max: 1,
  idleTimeoutMillis: 10000,
  ssl: local ? false : { rejectUnauthorized: false },
});
export const query = (text, params) => pool.query(text, params);
