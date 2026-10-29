async function call(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    method: opts.method,
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || res.statusText); e.status = res.status; e.code = data.code; throw e; }
  return data;
}
export const me = () => call("/api/me").catch((e) => (e.status === 401 ? null : Promise.reject(e)));
export const login = (email, password) => call("/api/login", { method: "POST", body: { email, password } });
export const logout = () => call("/api/logout", { method: "POST" });
export const bootstrap = () => call("/api/bootstrap");
export const createJob = (row) => call("/api/jobs", { method: "POST", body: row });
export const getJob = (jobNo) => call(`/api/jobs/${jobNo}`);
export const updateJob = (jobNo, updates) => call(`/api/jobs/${jobNo}`, { method: "PATCH", body: updates });
export const changePassword = (currentPassword, newPassword) => call("/api/profile", { method: "PUT", body: { currentPassword, newPassword } });
export const admin = (method, path, body) => call(`/api/admin/${path}`, { method, body });
