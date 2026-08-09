export interface ToolResultLike {
  content: unknown[];
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function validateName(value: string | null): string {
  const name = value?.trim() ?? "";

  if (name.length === 0) {
    throw new HttpError(400, "Name is required.");
  }

  if (Array.from(name).length > 80) {
    throw new HttpError(400, "Name must be 80 characters or fewer.");
  }

  return name;
}

export function extractText(result: ToolResultLike): string {
  const item = result.content.find(
    (entry): entry is { type: "text"; text: string } =>
      typeof entry === "object" &&
      entry !== null &&
      "type" in entry &&
      entry.type === "text" &&
      "text" in entry &&
      typeof entry.text === "string"
  );

  if (!item) {
    throw new Error("MCP tool returned no text content.");
  }

  return item.text;
}
