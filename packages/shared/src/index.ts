/**
 * Types shared between apps/web (which defines this contract) and any other
 * consumer — packages/cli, most concretely. Nothing here should import from
 * Next.js or any web-app-specific module: this package has to stay usable
 * from a plain Node.js CLI process with zero web-framework dependencies.
 *
 * If apps/web's API response shape or PRD structure changes, update it here
 * first — that's the whole point of pulling this out of apps/web/src/lib
 * instead of leaving the CLI to duplicate (and inevitably drift from) these
 * definitions on its own.
 */

// ---- API response envelope (matches apps/web/src/lib/api-response.ts) -----

export type ApiError = { code: string; message: string; details?: unknown };
export type ApiResponse<T> = { data: T; error: null } | { data: null; error: ApiError };

// ---- Generated PRD structure (matches apps/web/src/lib/openrouter.ts) -----

export type SubFeature = { id: string; name: string; description: string };

export type Feature = {
  id: string;
  name: string;
  phase: number;
  status: "planned";
  subFeatures: SubFeature[];
};

export type PrdContent = {
  title: string;
  overview: string;
  features: Feature[];
};
