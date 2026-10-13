import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { columnOptions, type BoardColumn, type CellValue } from "@/lib/columns";
import { extensionOf } from "@/lib/files";

export const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_OUTPUT_TOKENS = 8000;
const REQUEST_TIMEOUT_MS = 120_000;

const PDF_MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const DOCX_MAX_BYTES = 20 * 1024 * 1024;
const TEXT_MAX_BYTES = 2 * 1024 * 1024;
const VALUE_MAX_CHARS = 2000;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "tsv", "json", "log"]);

export class ExtractError extends Error {
  retry: boolean;
  constructor(message: string, retry = false) {
    super(message);
    this.retry = retry;
  }
}

export type ExtractFile = { name: string; type: string; bytes: Buffer };
export type ExtractField = { key: string; column: BoardColumn };
export type Extracted = {
  values: Map<string, CellValue>;
  empty: string[];
  model: string;
};

export const modelId = () =>
  process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const tooBig = (name: string, limit: number) =>
  new ExtractError(
    `${name} is over the ${Math.round(limit / 1024 / 1024)} MB limit for AI extraction.`,
  );

async function documentBlock(
  file: ExtractFile,
): Promise<Anthropic.Beta.BetaContentBlockParam> {
  const ext = extensionOf(file.name);
  if (file.type === "application/pdf" || ext === "pdf") {
    if (file.bytes.byteLength > PDF_MAX_BYTES)
      throw tooBig(file.name, PDF_MAX_BYTES);
    return {
      type: "document",
      title: file.name,
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: file.bytes.toString("base64"),
      },
    };
  }
  if (IMAGE_TYPES.has(file.type)) {
    if (file.bytes.byteLength > IMAGE_MAX_BYTES)
      throw tooBig(file.name, IMAGE_MAX_BYTES);
    return {
      type: "image",
      source: {
        type: "base64",
        media_type:
          file.type as Anthropic.Beta.BetaBase64ImageSource["media_type"],
        data: file.bytes.toString("base64"),
      },
    };
  }
  if (file.type === DOCX_TYPE || ext === "docx") {
    if (file.bytes.byteLength > DOCX_MAX_BYTES)
      throw tooBig(file.name, DOCX_MAX_BYTES);
    let text = "";
    try {
      text = (await mammoth.extractRawText({ buffer: file.bytes })).value;
    } catch {
      throw new ExtractError(`Couldn't read the text in ${file.name}.`);
    }
    if (!text.trim())
      throw new ExtractError(`${file.name} doesn't contain any text.`);
    return {
      type: "document",
      title: file.name,
      source: { type: "text", media_type: "text/plain", data: text },
    };
  }
  if (file.type.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) {
    if (file.bytes.byteLength > TEXT_MAX_BYTES)
      throw tooBig(file.name, TEXT_MAX_BYTES);
    const text = file.bytes.toString("utf8");
    if (!text.trim())
      throw new ExtractError(`${file.name} doesn't contain any text.`);
    return {
      type: "document",
      title: file.name,
      source: { type: "text", media_type: "text/plain", data: text },
    };
  }
  throw new ExtractError(
    `Can't read ${ext ? `.${ext}` : "that kind of"} files yet. Use a PDF, Word (.docx), image or plain text file.`,
  );
}

function fieldHint(column: BoardColumn) {
  switch (column.type) {
    case "email":
      return "an email address, lower-case";
    case "phone":
      return "a phone number as written, including the country code if given";
    case "date":
      return "a date in YYYY-MM-DD form";
    case "number":
      return "a number, digits only";
    case "checkbox":
      return "true only if the document clearly says so, otherwise null";
    case "link":
      return "a web address";
    case "status":
      return `one of: ${columnOptions(column)
        .map((option) => option.label)
        .join(", ")}`;
    default:
      return "short text";
  }
}

function property(column: BoardColumn) {
  const description = `${column.label}: ${fieldHint(column)}. Null if the document doesn't say.`;
  switch (column.type) {
    case "number":
      return {
        description,
        anyOf: [{ type: "number" }, { type: "null" }],
      };
    case "checkbox":
      return {
        description,
        anyOf: [{ type: "boolean" }, { type: "null" }],
      };
    case "status": {
      const labels = columnOptions(column).map((option) => option.label);
      return {
        description,
        anyOf: [
          labels.length ? { type: "string", enum: labels } : { type: "string" },
          { type: "null" },
        ],
      };
    }
    case "date":
      return {
        description,
        anyOf: [{ type: "string", format: "date" }, { type: "null" }],
      };
    default:
      return {
        description,
        anyOf: [{ type: "string" }, { type: "null" }],
      };
  }
}

export function slugKey(label: string, taken: Set<string>) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field";
  let key = base;
  for (let i = 2; taken.has(key); i += 1) key = `${base}_${i}`;
  taken.add(key);
  return key;
}

const SYSTEM_PROMPT = `You fill in CRM columns from a single document, which is usually a candidate's CV.
Use only what the document states. If a field isn't stated, return null for it rather than guessing.
Tidy values without changing their meaning: names in normal capitalisation, emails lower-case, dates as YYYY-MM-DD, a location as the town or city plus the country when given.
Return values only, with no labels, notes or explanations inside them.`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function cleanValue(column: BoardColumn, raw: unknown): CellValue {
  if (raw === null || raw === undefined) return null;
  switch (column.type) {
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim());
      return Number.isFinite(n) ? n : null;
    }
    case "checkbox":
      return raw === true ? true : null;
    case "status": {
      if (typeof raw !== "string") return null;
      const wanted = raw.trim().toLowerCase();
      const option = columnOptions(column).find(
        (entry) => entry.label.trim().toLowerCase() === wanted,
      );
      return option?.value ?? null;
    }
    case "date": {
      if (typeof raw !== "string" || !DATE_PATTERN.test(raw.trim()))
        return null;
      const value = raw.trim();
      return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
        ? null
        : value;
    }
    case "email": {
      if (typeof raw !== "string") return null;
      const value = raw.trim().toLowerCase();
      return EMAIL_PATTERN.test(value) ? value : null;
    }
    case "phone": {
      if (typeof raw !== "string") return null;
      const value = raw.replace(/[^\d+() -]/g, "").trim();
      return value.replace(/\D/g, "").length >= 7 ? value : null;
    }
    default: {
      const text =
        typeof raw === "string"
          ? raw
          : typeof raw === "number" || typeof raw === "boolean"
            ? String(raw)
            : "";
      const value = text.replace(/\s+/g, " ").trim().slice(0, VALUE_MAX_CHARS);
      return value || null;
    }
  }
}

export async function extractFields(
  file: ExtractFile,
  fields: ExtractField[],
): Promise<Extracted> {
  if (!aiConfigured())
    throw new ExtractError(
      "AI extraction isn't set up: add ANTHROPIC_API_KEY to the server.",
    );
  if (!fields.length) return { values: new Map(), empty: [], model: modelId() };

  const block = await documentBlock(file);
  const schema = {
    type: "object",
    properties: Object.fromEntries(
      fields.map((field) => [field.key, property(field.column)]),
    ),
    required: fields.map((field) => field.key),
    additionalProperties: false,
  };
  const list = fields
    .map((field) => `- ${field.column.label} (${fieldHint(field.column)})`)
    .join("\n");

  const client = new Anthropic({
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 2,
  });
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: modelId(),
      max_tokens: MAX_OUTPUT_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      messages: [
        {
          role: "user",
          content: [
            block,
            {
              type: "text",
              text: `Fill in these fields from the document:\n${list}`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      throw new ExtractError(
        "The ANTHROPIC_API_KEY on the server was rejected.",
      );
    if (error instanceof Anthropic.RateLimitError)
      throw new ExtractError(
        "The AI service is busy. It will be retried.",
        true,
      );
    if (error instanceof Anthropic.BadRequestError)
      throw new ExtractError(
        `The AI service rejected the file: ${error.message}`,
      );
    if (error instanceof Anthropic.APIConnectionError)
      throw new ExtractError(
        "Couldn't reach the AI service. It will be retried.",
        true,
      );
    if (error instanceof Anthropic.APIError && error.status >= 500)
      throw new ExtractError(
        "The AI service had a problem. It will be retried.",
        true,
      );
    throw new ExtractError(
      error instanceof Error ? error.message : "AI extraction failed.",
    );
  }

  if (response.stop_reason === "refusal")
    throw new ExtractError("The AI declined to read this file.");
  if (response.stop_reason === "max_tokens")
    throw new ExtractError("The AI's answer was cut short. Try again.", true);

  const text = response.content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ExtractError(
      "The AI's answer couldn't be read. Try again.",
      true,
    );
  }
  const record =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  const values = new Map<string, CellValue>();
  const empty: string[] = [];
  for (const field of fields) {
    const value = cleanValue(field.column, record[field.key]);
    if (value === null) empty.push(field.column.id);
    else values.set(field.column.id, value);
  }
  return { values, empty, model: response.model };
}
