import "dotenv/config";

import { buildApp } from "./app";
import { connectDatabase } from "./config/database";
import { connectQdrant } from "./config/qdrant";
import { seedAdmin } from "./modules/auth/auth.service";

async function startServer() {
  await connectDatabase();
  await connectQdrant();
  await seedAdmin();

  const app = await buildApp();

  await app.listen({
    port: Number(process.env.PORT || 3000),
    host: "0.0.0.0"
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
