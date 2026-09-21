import type { PreviewResult } from "./spec";

/** Placeholder — replaced by the real generator (fetch → extract → map). */
export async function generatePreview(input: string): Promise<PreviewResult> {
  void input;
  return { ok: false, code: "fetch_failed", error: "Preview generator not implemented yet." };
}
