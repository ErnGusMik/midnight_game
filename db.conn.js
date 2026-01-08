import { S3Client } from "@aws-sdk/client-s3";
import { JsonDB, Config } from "node-json-db";

const db = new JsonDB(new Config("midnightGameDB", true, false, '/'));

export const s3 = new S3Client({
  region: "auto",
  endpoint: "https://silo.deployor.dev",
  forcePathStyle: true, // avoid bucket-as-subdomain (prevents ENOTFOUND midnight-dev.silo.deployor.dev)
  credentials: {
    accessKeyId: "CK4DAECEFA64B59D7C0026",
    secretAccessKey: "02124a7a73505dc97dfdc09956558f7e5c3b0f54"
  },
  systemClockOffset: 0, // AWS SDK will auto-correct clock skew
});

export default db;