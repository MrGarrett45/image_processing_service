import request from "supertest";
import sharp from "sharp";
import axios from "axios";
import { app } from "../src/app";
import * as storageService from "../src/services/storageService";

jest.mock("axios");
jest.mock("../src/services/storageService");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedStorage = storageService as jest.Mocked<typeof storageService>;

async function createTestPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  })
    .png()
    .toBuffer();
}

describe("GET /process", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.buildPublicUrl.mockImplementation(
      (key) => `https://example.com/${key}`
    );
  });

  it("returns 400 when url is missing", async () => {
    const response = await request(app).get("/process");
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/url is required/i);
  });

  it("returns 400 when width is invalid", async () => {
    const response = await request(app).get("/process").query({
      url: "https://8.8.8.8/image.png",
      width: "0"
    });
    expect(response.status).toBe(400);
  });

  it("returns 415 when content type is not an image", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from("not an image"),
      headers: { "content-type": "text/plain" }
    });
    mockedStorage.getObjectIfExists.mockResolvedValueOnce(false);

    const response = await request(app).get("/process").query({
      url: "https://8.8.8.8/image.txt"
    });
    expect(response.status).toBe(415);
  });

  it("processes and uploads image when not cached", async () => {
    const buffer = await createTestPng();
    mockedAxios.get.mockResolvedValueOnce({
      data: buffer,
      headers: { "content-type": "image/png" }
    });
    mockedStorage.getObjectIfExists.mockResolvedValueOnce(false);
    mockedStorage.uploadObject.mockResolvedValueOnce({
      key: "images/test.png",
      url: "https://example.com/images/test.png"
    });

    const response = await request(app).get("/process").query({
      url: "https://8.8.8.8/image.png",
      width: "100",
      height: "100"
    });

    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(false);
    expect(response.body.url).toBe("https://example.com/images/test.png");
    expect(response.body.width).toBe(100);
    expect(response.body.height).toBe(100);
    expect(response.body.format).toBe("png");
    expect(mockedStorage.uploadObject).toHaveBeenCalled();
  });

  it("returns cached response when object exists", async () => {
    mockedStorage.getObjectIfExists.mockResolvedValueOnce(true);

    const response = await request(app).get("/process").query({
      url: "https://8.8.8.8/image.png"
    });

    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(true);
    expect(mockedStorage.uploadObject).not.toHaveBeenCalled();
  });
});
