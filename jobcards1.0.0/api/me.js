import { getUser } from "../server/auth.js";
export default async function handler(req, res) {
  const u = await getUser(req);
  if (!u) return res.status(401).json({ error: "Not signed in" });
  res.json(u);
}
