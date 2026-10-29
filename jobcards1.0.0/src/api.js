// VITE_MOCK=1 (npm run dev:ui) swaps the real API for in-memory sample data.
import * as real from "./api.real.js";
import * as mock from "./api.mock.js";
const a = import.meta.env.VITE_MOCK === "1" ? mock : real;
export const { me, login, logout, bootstrap, createJob, getJob, updateJob, changePassword, admin } = a;
