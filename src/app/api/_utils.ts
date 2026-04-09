import { NextResponse } from "next/server";

export const INTERNAL_SERVER_ERROR_MESSAGE = "Internal server error.";
export const PROJECT_NOT_FOUND_ERROR = "Project not found.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRequiredParam(
  value: string | undefined | null,
  label: string,
): { value: string | null; response: NextResponse<{ error: string }> | null } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return {
      value: null,
      response: NextResponse.json({ error: `${label} is required.` }, { status: 400 }),
    };
  }

  return { value: trimmed, response: null };
}

export function getRequiredUuidParam(
  value: string | undefined | null,
  label: string,
  invalidMessage: string,
): { value: string | null; response: NextResponse<{ error: string }> | null } {
  const required = getRequiredParam(value, label);
  if (required.response || !required.value) {
    return required;
  }

  if (!UUID_PATTERN.test(required.value)) {
    return {
      value: null,
      response: NextResponse.json({ error: invalidMessage }, { status: 400 }),
    };
  }

  return required;
}

export function jsonData<T>(data: T, init?: ResponseInit): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, init);
}

export function jsonError(message: string, status: number): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}

export function isPrefixedError(error: unknown, prefixes: string[]): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  return prefixes.some((prefix) => error.message.startsWith(prefix)) ? error.message : null;
}
