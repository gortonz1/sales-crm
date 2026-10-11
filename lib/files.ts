import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type { CustomRow, StoredFile } from "@/lib/columns";

export const FILES_BUCKET = "crm-files";
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;

const URL_SECONDS = 60 * 60;
const URL_REUSE_MS = 50 * 60 * 1000;

export type FileKind =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "text"
  | "office"
  | "other";

const OFFICE_VIEWER = "https://view.officeapps.live.com/op/embed.aspx";
const OFFICE_LIMITS: Record<string, number> = {
  doc: 10,
  docx: 10,
  ppt: 10,
  pptx: 10,
  xls: 5,
  xlsx: 5,
};

export const officeLimitBytes = (name: string) =>
  (OFFICE_LIMITS[extensionOf(name)] ?? 0) * 1024 * 1024;

export const officeViewerUrl = (fileUrl: string) =>
  `${OFFICE_VIEWER}?src=${encodeURIComponent(fileUrl)}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function asFiles(value: Json): StoredFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { id, name, path, size, type, uploadedAt } = entry;
    if (
      typeof id !== "string" ||
      typeof name !== "string" ||
      typeof path !== "string"
    )
      return [];
    return [
      {
        id,
        name,
        path,
        size: typeof size === "number" ? size : 0,
        type: typeof type === "string" ? type : "",
        uploadedAt: typeof uploadedAt === "string" ? uploadedAt : "",
      },
    ];
  });
}

export const extensionOf = (name: string) => {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
};

const TEXT_EXTENSIONS = new Set(["txt", "csv", "tsv", "json", "md", "log"]);

export function fileKind(file: Pick<StoredFile, "name" | "type">): FileKind {
  const ext = extensionOf(file.name);
  if (file.type.startsWith("image/") && file.type !== "image/heic")
    return "image";
  if (file.type === "application/pdf" || ext === "pdf") return "pdf";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) return "text";
  if (ext in OFFICE_LIMITS) return "office";
  return "other";
}

const BADGE_COLORS: { color: string; extensions: string[] }[] = [
  { color: "#ef4444", extensions: ["pdf"] },
  { color: "#4c8df6", extensions: ["doc", "docx", "rtf", "odt", "pages"] },
  {
    color: "#16803c",
    extensions: ["xls", "xlsx", "csv", "tsv", "ods", "numbers"],
  },
  { color: "#d9480f", extensions: ["ppt", "pptx", "odp", "key"] },
  { color: "#0e7490", extensions: ["zip", "rar", "7z", "gz"] },
];

export function badgeColor(file: Pick<StoredFile, "name" | "type">) {
  const kind = fileKind(file);
  if (kind === "image") return "#9d7cf0";
  if (kind === "video" || kind === "audio") return "#c026d3";
  const ext = extensionOf(file.name);
  return (
    BADGE_COLORS.find((entry) => entry.extensions.includes(ext))?.color ??
    "#6b6b6b"
  );
}

export const badgeLabel = (file: Pick<StoredFile, "name">) =>
  (extensionOf(file.name) || "file").slice(0, 4).toUpperCase();

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function filePaths(rows: CustomRow[]) {
  return rows.flatMap((row) => {
    const custom = row.custom;
    if (!isRecord(custom)) return [];
    return Object.values(custom).flatMap((value) =>
      asFiles(value ?? null).map((file) => file.path),
    );
  });
}

export async function uploadFile(
  columnId: string,
  rowId: string,
  file: File,
): Promise<StoredFile> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is over the 50 MB limit.`);
  }
  const id = crypto.randomUUID();
  const ext = extensionOf(file.name);
  const path = `${columnId}/${rowId}/${id}${ext ? `.${ext}` : ""}`;
  const { error } = await createClient()
    .storage.from(FILES_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(`Couldn't upload ${file.name}: ${error.message}`);
  return {
    id,
    name: file.name.slice(0, 255),
    path,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString(),
  };
}

const urlCache = new Map<string, { url: string; at: number }>();

export async function fileUrl(path: string, downloadName?: string) {
  const key = downloadName ? `${path}::${downloadName}` : path;
  const cached = urlCache.get(key);
  if (cached && Date.now() - cached.at < URL_REUSE_MS) return cached.url;
  const { data, error } = await createClient()
    .storage.from(FILES_BUCKET)
    .createSignedUrl(
      path,
      URL_SECONDS,
      downloadName ? { download: downloadName } : undefined,
    );
  if (error || !data) {
    throw new Error(error?.message ?? "Couldn't open the file.");
  }
  urlCache.set(key, { url: data.signedUrl, at: Date.now() });
  return data.signedUrl;
}

export async function removeFiles(paths: string[]) {
  if (!paths.length) return;
  const storage = createClient().storage.from(FILES_BUCKET);
  for (let i = 0; i < paths.length; i += 100) {
    await storage.remove(paths.slice(i, i + 100));
  }
}

export async function removeColumnFiles(columnId: string) {
  const storage = createClient().storage.from(FILES_BUCKET);
  const { data: rows } = await storage.list(columnId, { limit: 1000 });
  for (const row of rows ?? []) {
    const folder = `${columnId}/${row.name}`;
    const { data: files } = await storage.list(folder, { limit: 1000 });
    await removeFiles((files ?? []).map((file) => `${folder}/${file.name}`));
  }
}
