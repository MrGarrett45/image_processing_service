import request from "supertest";
import sharp from "sharp";
import axios from "axios";
import { app } from "../src/app";
import * as storageService from "../src/services/storageService";
import * as videoService from "../src/services/videoService";

jest.mock("axios");
jest.mock("../src/services/storageService");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedStorage = storageService as jest.Mocked<typeof storageService>;

async function createTestJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 0, g: 255, b: 0 }
    }
  })
    .jpeg()
    .toBuffer();
}

describe("GET /video/thumbnail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.buildPublicUrl.mockImplementation(
      (key) => `https://example.com/${key}`
    );
  });

  it("returns 400 when time is missing", async () => {
    const response = await request(app).get("/video/thumbnail").query({
      url: "https://8.8.8.8/video.mp4"
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/time is required/i);
  });

  it("processes and uploads thumbnail when not cached", async () => {
    const frameBuffer = await createTestJpeg();
    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from("fake video bytes"),
      headers: { "content-type": "video/mp4" }
    });
    mockedStorage.getObjectIfExists.mockResolvedValueOnce(false);
    mockedStorage.uploadObject.mockResolvedValueOnce({
      key: "thumbnails/test.jpeg",
      url: "https://example.com/thumbnails/test.jpeg"
    });
    jest
      .spyOn(videoService, "extractFrameBuffer")
      .mockResolvedValueOnce(frameBuffer);

    const response = await request(app).get("/video/thumbnail").query({
      url: "https://8.8.8.8/video.mp4",
      time: "1",
      width: "120"
    });

    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(false);
    expect(response.body.url).toBe("https://example.com/thumbnails/test.jpeg");
    expect(response.body.format).toBe("jpeg");
    expect(mockedStorage.uploadObject).toHaveBeenCalled();
  });

  it("returns cached response when object exists", async () => {
    mockedStorage.getObjectIfExists.mockResolvedValueOnce(true);

    const response = await request(app).get("/video/thumbnail").query({
      url: "https://8.8.8.8/video.mp4",
      time: "2"
    });

    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(true);
    expect(mockedStorage.uploadObject).not.toHaveBeenCalled();
  });
});
