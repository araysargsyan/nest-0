import { loadEnvFile } from "node:process";
import { defineConfig, env } from "prisma/config";

try {
  loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DB_URL"),
  },
});
