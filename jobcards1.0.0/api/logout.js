import { endSession } from "../server/auth.js";
export default function handler(req, res) { endSession(res); res.json({ ok: true }); }
