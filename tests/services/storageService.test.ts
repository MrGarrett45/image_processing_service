const sendMock = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({ send: sendMock })),
  HeadObjectCommand: jest.fn((input) => ({ input })),
  PutObjectCommand: jest.fn((input) => ({ input }))
}));

import { StorageError } from "../../src/errors/StorageError";
import { buildPublicUrl, getObjectIfExists, uploadObject } from "../../src/services/storageService";

describe("storageService", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("builds public URLs from env config", () => {
    const url = buildPublicUrl("images/test.png");
    expect(url).toBe("https://test-bucket.s3.us-east-1.amazonaws.com/images/test.png");
  });

  it("returns true when object exists", async () => {
    sendMock.mockResolvedValueOnce({});
    await expect(getObjectIfExists("images/test.png")).resolves.toBe(true);
  });

  it("returns false when object does not exist", async () => {
    sendMock.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });
    await expect(getObjectIfExists("images/missing.png")).resolves.toBe(false);
  });

  it("throws StorageError for non-404 errors", async () => {
    sendMock.mockRejectedValueOnce(new Error("boom"));
    await expect(getObjectIfExists("images/bad.png")).rejects.toBeInstanceOf(StorageError);
  });

  it("uploads objects with correct parameters", async () => {
    sendMock.mockResolvedValueOnce({});
    const result = await uploadObject("images/out.webp", Buffer.from("data"), "image/webp");
    expect(result.key).toBe("images/out.webp");
    expect(result.url).toContain("images/out.webp");

    const commandInput = sendMock.mock.calls[0][0].input;
    expect(commandInput).toMatchObject({
      Bucket: "test-bucket",
      Key: "images/out.webp",
      ContentType: "image/webp",
      CacheControl: "public,max-age=31536000,immutable"
    });
  });
});
