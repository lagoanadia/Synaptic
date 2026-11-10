import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR, HAIRS, avatarSvg, cleanHandle, HANDLE, parseAvatar, randomAvatar } from "./avatar";

describe("parseAvatar", () => {
  it("falls back to the default for nothing or junk", () => {
    expect(parseAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(parseAvatar({ hair: "<script>", skin: 99, bg: -1, star: "yes" })).toEqual(DEFAULT_AVATAR);
  });
  it("keeps valid choices", () => {
    expect(parseAvatar({ ...DEFAULT_AVATAR, hair: "coleta", skin: 4, glasses: "sol" })).toMatchObject({ hair: "coleta", skin: 4, glasses: "sol" });
  });
});

describe("avatarSvg", () => {
  it("draws every hairstyle", () => {
    for (const hair of HAIRS) expect(avatarSvg({ ...DEFAULT_AVATAR, hair }, "x")).toContain("<svg");
  });
  it("never lets stored text into the SVG", () => {
    const svg = avatarSvg({ ...DEFAULT_AVATAR, hair: '"><script>' } as never, 'a"b');
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain('a"b');
  });
  it("random avatars are valid", () => {
    for (let i = 0; i < 50; i++) {
      const a = randomAvatar();
      expect(parseAvatar(a)).toEqual(a);
    }
  });
});

describe("handles", () => {
  it("cleans and checks", () => {
    expect(cleanHandle(" @Nadia_L ")).toBe("nadia_l");
    expect(HANDLE.test("ab")).toBe(false);
    expect(HANDLE.test("nadia.l")).toBe(true);
    expect(HANDLE.test("na dia")).toBe(false);
  });
});
