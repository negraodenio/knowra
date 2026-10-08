import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";

config({ path: resolve(process.cwd(), ".env.local") });

try {
  execSync("npx supabase db push --include-all", {
    stdio: "inherit",
    env: {
      ...process.env,
    },
  });
} catch (err) {
  process.exit(1);
}
