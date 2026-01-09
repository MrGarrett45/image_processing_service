import axios from "axios";
import sharp from "sharp";
import { RemoteFetchError } from "../../src/errors/RemoteFetchError";
import { UnsupportedMediaError } from "../../src/errors/UnsupportedMediaError";
import { processImage } from "../../src/services/imageService";
import * as storageService from "../../src/services/storageService";

jest.mock("axios");
jest.mock("sharp", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../src/services/storageService");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedStorage = storageService as jest.Mocked<typeof storageService>;

describe("imageService.processImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupSharpMock() {
    const resizeMock = jest.fn().mockReturnThis();
    const metadataMock = jest.fn().mockResolvedValue({ format: "png" });
    const toFormatMock = jest.fn().mockReturnThis();
    const toBufferMock = jest.fn().mockResolvedValue({
      data: Buffer.from("output"),
      info: { width: 100, height: 50 }
    });

    const sharpMock = sharp as unknown as jest.Mock;
    sharpMock.mockImplementation(() => ({
      resize: resizeMock,
      metadata: metadataMock,
      toFormat: toFormatMock,
      toBuffer: toBufferMock
    }));

    return { resizeMock, metadataMock, toFormatMock, toBufferMock };
  }

  it("returns cached response when S3 has the object", async () => {
    mockedStorage.getObjectIfExists.mockResolvedValueOnce(true);
    mockedStorage.buildPublicUrl.mockReturnValue("https://example.com/images/hash.png");

    const result = await processImage({
      url: "https://example.com/image.png"
    });

    expect(result.cached).toBe(true);
    expect(result.url).toBe("https://example.com/images/hash.png");
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("resizes and applies crop mapping and quality", async () => {
    const { resizeMock, toFormatMock } = setupSharpMock();
    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from("image"),
      headers: { "content-type": "image/png" }
    });
    mockedStorage.getObjectIfExists.mockResolvedValue(false);
    mockedStorage.uploadObject.mockResolvedValueOnce({
      key: "images/hash.png",
      url: "https://example.com/images/hash.png"
    });

    const result = await processImage({
      url: "https://example.com/image.png",
      width: 100,
      height: 50,
      crop: "fit",
      quality: 80
    });

    expect(resizeMock).toHaveBeenCalledWith({
      width: 100,
      height: 50,
      fit: "contain",
      withoutEnlargement: true
    });
    expect(toFormatMock).toHaveBeenCalledWith("png", { quality: 80 });
    expect(result.cached).toBe(false);
    expect(result.format).toBe("png");
  });

  it("throws UnsupportedMediaError for non-image content type", async () => {
    setupSharpMock();
    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from("not an image"),
      headers: { "content-type": "text/plain" }
    });
    mockedStorage.getObjectIfExists.mockResolvedValue(false);

    await expect(
      processImage({
        url: "https://example.com/file.txt"
      })
    ).rejects.toBeInstanceOf(UnsupportedMediaError);
  });

  it("throws RemoteFetchError on request timeout", async () => {
    setupSharpMock();
    mockedAxios.get.mockRejectedValueOnce({ code: "ECONNABORTED" });
    mockedStorage.getObjectIfExists.mockResolvedValue(false);

    await expect(
      processImage({
        url: "https://example.com/image.png"
      })
    ).rejects.toBeInstanceOf(RemoteFetchError);
  });
});
