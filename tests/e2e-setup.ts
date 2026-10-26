import { rm, mkdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
const legacyId = "00000000-0000-0000-0000-000000000001";
export default async function setup() {
  await rm("/tmp/tabelog-e2e", { recursive: true, force: true });
  await mkdir("/tmp/tabelog-e2e", { recursive: true });
  const db = new DatabaseSync("/tmp/tabelog-e2e/diary.sqlite");
  db.exec(await readFile("scripts/schema.sql", "utf8"));
  db.prepare("INSERT INTO entries (id,data,updated_at) VALUES (?,?,?)").run(
    legacyId,
    JSON.stringify({ id: legacyId, name: "旧版私密记录", photos: [] }),
    new Date().toISOString(),
  );
  db.close();
}
