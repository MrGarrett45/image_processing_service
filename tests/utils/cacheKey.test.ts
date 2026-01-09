import { buildCacheKey, buildImageKey, buildThumbnailKey } from "../../src/utils/cacheKey";

describe("cacheKey utils", () => {
  it("returns deterministic hashes for same inputs", () => {
    const first = buildCacheKey({
      url: "https://example.com/image.jpg",
      width: 100,
      height: 200,
      format: "jpeg",
      quality: 80,
      crop: "fill"
    });
    const second = buildCacheKey({
      url: "https://example.com/image.jpg",
      width: 100,
      height: 200,
      format: "jpeg",
      quality: 80,
      crop: "fill"
    });
    expect(first).toBe(second);
  });

  it("changes hash when inputs change", () => {
    const base = buildCacheKey({
      url: "https://example.com/image.jpg",
      width: 100,
      height: 200,
      format: "jpeg",
      quality: 80,
      crop: "fill"
    });
    const changed = buildCacheKey({
      url: "https://example.com/image.jpg",
      width: 101,
      height: 200,
      format: "jpeg",
      quality: 80,
      crop: "fill"
    });
    expect(base).not.toBe(changed);
  });

  it("builds image and thumbnail keys", () => {
    expect(buildImageKey("hash", "png")).toBe("images/hash.png");
    expect(buildThumbnailKey("hash", "jpeg")).toBe("thumbnails/hash.jpeg");
  });
});
