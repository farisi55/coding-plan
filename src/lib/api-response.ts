import { NextResponse } from "next/server";

/**
 * Standard envelope for every API route: { data, error }, never both populated.
 * error.code is machine-readable (UPPER_SNAKE_CASE) so clients (including the
 * future CLI) can branch on it without string-matching error.message.
 */
export type ApiError = { code: string; message: string; details?: unknown };
export type ApiResponse<T> = { data: T; error: null } | { data: null; error: ApiError };

export function apiOk<T>(data: T, init?: number): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, error: null }, { status: init ?? 200 });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ data: null, error: { code, message, details } }, { status });
}
