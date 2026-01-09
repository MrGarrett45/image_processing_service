import { BadRequestError } from "../../src/errors/BadRequestError";
import {
  parseCrop,
  parseFormat,
  parsePositiveInt,
  parseQuality,
  parseTime,
  validateProcessQuery,
  validateRemoteUrl,
  validateVideoThumbnailQuery
} from "../../src/utils/validation";

describe("validation utils", () => {
  describe("parsePositiveInt", () => {
    it("parses valid values", () => {
      expect(parsePositiveInt("10", "width")).toBe(10);
      expect(parsePositiveInt(undefined, "width")).toBeUndefined();
    });

    it("rejects invalid values", () => {
      expect(() => parsePositiveInt("0", "width")).toThrow(BadRequestError);
      expect(() => parsePositiveInt("-5", "width")).toThrow(BadRequestError);
      expect(() => parsePositiveInt("1.5", "width")).toThrow(BadRequestError);
    });
  });

  describe("parseQuality", () => {
    it("parses valid values", () => {
      expect(parseQuality("1")).toBe(1);
      expect(parseQuality("100")).toBe(100);
      expect(parseQuality(undefined)).toBeUndefined();
    });

    it("rejects invalid values", () => {
      expect(() => parseQuality("0")).toThrow(BadRequestError);
      expect(() => parseQuality("101")).toThrow(BadRequestError);
      expect(() => parseQuality("abc")).toThrow(BadRequestError);
    });
  });

  describe("parseTime", () => {
    it("parses valid values", () => {
      expect(parseTime("0")).toBe(0);
      expect(parseTime("1.5")).toBe(1.5);
    });

    it("rejects invalid values", () => {
      expect(() => parseTime(undefined)).toThrow(BadRequestError);
      expect(() => parseTime("-1")).toThrow(BadRequestError);
      expect(() => parseTime("nan")).toThrow(BadRequestError);
    });
  });

  describe("parseFormat", () => {
    it("accepts valid formats", () => {
      expect(parseFormat("jpeg")).toBe("jpeg");
      expect(parseFormat("jpg")).toBe("jpeg");
      expect(parseFormat("png")).toBe("png");
      expect(parseFormat(undefined)).toBeUndefined();
    });

    it("rejects invalid formats", () => {
      expect(() => parseFormat("gif")).toThrow(BadRequestError);
    });
  });

  describe("parseCrop", () => {
    it("defaults to fill", () => {
      expect(parseCrop(undefined)).toBe("fill");
    });

    it("accepts valid modes", () => {
      expect(parseCrop("fit")).toBe("fit");
      expect(parseCrop("inside")).toBe("inside");
    });

    it("rejects invalid modes", () => {
      expect(() => parseCrop("stretch")).toThrow(BadRequestError);
    });
  });

  describe("validateRemoteUrl", () => {
    it("accepts http and https URLs", async () => {
      await expect(validateRemoteUrl("https://example.com/image.png")).resolves.toBe(
        "https://example.com/image.png"
      );
      await expect(validateRemoteUrl("http://example.com")).resolves.toBe(
        "http://example.com/"
      );
    });

    it("rejects invalid URLs", async () => {
      await expect(validateRemoteUrl(undefined)).rejects.toThrow(BadRequestError);
      await expect(validateRemoteUrl("ftp://example.com")).rejects.toThrow(
        BadRequestError
      );
      await expect(validateRemoteUrl("not-a-url")).rejects.toThrow(BadRequestError);
    });
  });

  describe("validateProcessQuery", () => {
    it("parses query values", async () => {
      const result = await validateProcessQuery({
        url: "https://example.com/image.png",
        width: "100",
        height: "200",
        format: "webp",
        quality: "80",
        crop: "fit"
      });
      expect(result).toEqual({
        url: "https://example.com/image.png",
        width: 100,
        height: 200,
        format: "webp",
        quality: 80,
        crop: "fit"
      });
    });

    it("uses first value when query param is an array", async () => {
      const result = await validateProcessQuery({
        url: ["https://example.com/image.png", "https://ignored.com"],
        width: ["120"]
      });
      expect(result.url).toBe("https://example.com/image.png");
      expect(result.width).toBe(120);
    });
  });

  describe("validateVideoThumbnailQuery", () => {
    it("parses query values", async () => {
      const result = await validateVideoThumbnailQuery({
        url: "https://example.com/video.mp4",
        time: "2",
        width: "160"
      });
      expect(result).toEqual({
        url: "https://example.com/video.mp4",
        time: 2,
        width: 160,
        height: undefined,
        format: undefined,
        quality: undefined
      });
    });
  });
});
