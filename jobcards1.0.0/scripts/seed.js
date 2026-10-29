import { pool } from "../server/db.js";
import { hashPassword } from "../server/auth.js";
const { rows } = await pool.query("SELECT count(*)::int AS n FROM users");
if (rows[0].n === 0) {
  const { ADMIN_NAME = "Admin", ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env");
  await pool.query("INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'admin')", [ADMIN_NAME, ADMIN_EMAIL, await hashPassword(ADMIN_PASSWORD)]);
  console.log("Created admin", ADMIN_EMAIL, "(must change password at first login)");
} else console.log("Users already exist - admin not created.");
if (process.env.SEED_SAMPLE === "1") {
  const banks = [["First National Bank", "FNB"], ["Absa Bank Zambia", "ABS"], ["Zanaco", "ZNC"]];
  for (const [n, c] of banks) await pool.query("INSERT INTO banks (name, short_code) VALUES ($1,$2) ON CONFLICT DO NOTHING", [n, c]);
  const towns = ["Manda Hill", "Cairo Road", "Kitwe", "Ndola", "Livingstone", "Mkushi", "Chipata", "Kabwe"];
  for (let i = 1; i <= 40; i++) {
    const code = banks[i % 3][1];
    await pool.query(`INSERT INTO atms (terminal_id, model, location, bank_id)
      SELECT $1, $2, $3, id FROM banks WHERE short_code=$4 ON CONFLICT DO NOTHING`,
      [`ATM-${code}-${1000 + i}`, i % 2 ? "NCR SelfServ 34" : "NCR SelfServ 22", `${towns[i % towns.length]} Branch`, code]);
  }
  console.log("Sample banks and 40 ATMs loaded.");
}
await pool.end();
