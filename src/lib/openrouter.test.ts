import { describe, it, expect } from "vitest";
import { slugify } from "./openrouter";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Baca Alquran")).toBe("baca-alquran");
  });

  it("strips characters that aren't letters or numbers", () => {
    expect(slugify("Arah Kiblat!! (v2)")).toBe("arah-kiblat-v2");
  });

  it("trims leading/trailing hyphens left over from stripped characters", () => {
    expect(slugify("--Jadwal Sholat--")).toBe("jadwal-sholat");
  });
});
