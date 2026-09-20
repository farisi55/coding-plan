import { NextResponse } from "next/server";
import type { ApiResponse } from "@coding-plan/shared";

/**
 * Standard envelope for every API route: { data, error }, never both populated.
 * error.code is machine-readable (UPPER_SNAKE_CASE) so clients (including the
 * future CLI) can branch on it without string-matching error.message.
 * The ApiError/ApiResponse types themselves live in @coding-plan/shared —
 * apiOk/apiError below are just the Next.js-specific helpers that produce them.
 */

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
