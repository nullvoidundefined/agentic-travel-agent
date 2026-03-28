import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const PROJECT_ID = process.env.GCP_PROJECT_ID ?? "67254912843";

const SECRET_MAP: Record<string, string> = {
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
  SERPAPI_API_KEY: "SERPAPI_API_KEY",
  GOOGLE_PLACES_API_KEY: "GOOGLE_PLACES_API_KEY",
};

async function fetchSecret(client: SecretManagerServiceClient, secretId: string): Promise<string> {
  const name = `projects/${PROJECT_ID}/secrets/${secretId}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  return version.payload!.data!.toString();
}

export async function loadSecrets(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const saJson = process.env.GCP_SA_JSON;
  if (!saJson) {
    console.warn("GCP_SA_JSON not set — using Railway environment variables directly");
    return;
  }

  const client = new SecretManagerServiceClient({
    credentials: JSON.parse(saJson),
  });

  await Promise.all(
    Object.entries(SECRET_MAP).map(async ([envKey, secretId]) => {
      process.env[envKey] = await fetchSecret(client, secretId);
    }),
  );
}
