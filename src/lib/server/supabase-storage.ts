import "server-only";

type StorageBucket = {
  id: string;
  public: boolean;
};

function getStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.SUPABASE_PDF_BUCKET;

  if (!supabaseUrl || !serviceRoleKey || !bucketName) {
    throw new Error(
      "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_PDF_BUCKET must be configured.",
    );
  }

  return {
    baseUrl: supabaseUrl.replace(/\/$/, ""),
    bucketName,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  };
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function requirePrivatePdfBucket() {
  const config = getStorageConfig();
  const response = await fetch(
    `${config.baseUrl}/storage/v1/bucket/${encodeURIComponent(config.bucketName)}`,
    { headers: config.headers, cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(
      `The private PDF bucket "${config.bucketName}" is unavailable.`,
    );
  }

  const bucket = (await response.json()) as StorageBucket;

  if (bucket.public) {
    throw new Error(`The PDF bucket "${config.bucketName}" must be private.`);
  }

  return config.bucketName;
}

export async function uploadPrivatePdf(
  bucketName: string,
  storagePath: string,
  bytes: Buffer,
) {
  const config = getStorageConfig();
  const response = await fetch(
    `${config.baseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}/${encodeStoragePath(storagePath)}`,
    {
      method: "POST",
      headers: {
        ...config.headers,
        "Content-Type": "application/pdf",
        "x-upsert": "false",
      },
      body: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    },
  );

  if (response.ok) {
    return "created" as const;
  }

  if (response.status === 409) {
    return "exists" as const;
  }

  throw new Error("The PDF could not be stored.");
}

export async function removePrivatePdf(
  bucketName: string,
  storagePath: string,
) {
  const config = getStorageConfig();
  const response = await fetch(
    `${config.baseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}`,
    {
      method: "DELETE",
      headers: {
        ...config.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [storagePath] }),
    },
  );

  if (!response.ok) {
    console.error("Failed to remove orphaned PDF from private storage.");
  }
}

export async function downloadPrivatePdf(storagePath: string) {
  const config = getStorageConfig();
  await requirePrivatePdfBucket();
  const response = await fetch(
    `${config.baseUrl}/storage/v1/object/${encodeURIComponent(config.bucketName)}/${encodeStoragePath(storagePath)}`,
    { headers: config.headers, cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("The private PDF could not be retrieved.");
  }

  return Buffer.from(await response.arrayBuffer());
}
