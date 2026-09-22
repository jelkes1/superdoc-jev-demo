import { env } from "cloudflare:workers";
export interface AppEnv {
  DB: D1Database;
  TYPESAFE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  JEV_MODEL?: string;
  REASONING_MODEL?: string;
  DAILY_BUDGET_USD?: string;
  IP_HASH_SALT?: string;
}
export function appEnv() {
  return env as unknown as AppEnv;
}
