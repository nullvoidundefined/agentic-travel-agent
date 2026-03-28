import "dotenv/config";
import { loadSecrets } from "app/config/secrets.js";

await loadSecrets();

const { startServer } = await import("app/app.js");
startServer();
