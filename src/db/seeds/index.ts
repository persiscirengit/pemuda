import { seedAuth } from "./auth";
import { seedDomain } from "./domain";

async function main() {
  console.log("🌱 Running system seeders...");
  await seedAuth();
  await seedDomain();
  console.log("✨ All system seeds completed successfully.");
}

if (process.argv[1]?.includes("seeds/index.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seeding failed:", err);
      process.exit(1);
    });
}

export { main as seedAll };
