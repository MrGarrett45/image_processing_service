import request from "supertest";
import { app } from "../../src/app";
import { BadRequestError } from "../../src/errors/BadRequestError";
import { ProcessingError } from "../../src/errors/ProcessingError";
import { processVideoThumbnail } from "../../src/services/videoService";

jest.mock("../../src/services/videoService", () => ({
  processVideoThumbnail: jest.fn()
}));

const mockedProcessVideoThumbnail = processVideoThumbnail as jest.MockedFunction<
  typeof processVideoThumbnail
>;

describe("GET /video/thumbnail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when time is missing", async () => {
    const response = await request(app).get("/video/thumbnail").query({
      url: "https://example.com/video.mp4"
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/time is required/i);
    expect(mockedProcessVideoThumbnail).not.toHaveBeenCalled();
  });

  it("returns 200 on success", async () => {
    mockedProcessVideoThumbnail.mockResolvedValueOnce({
      url: "https://example.com/thumbnails/hash.jpeg",
      key: "thumbnails/hash.jpeg",
      cached: false,
      width: 120,
      height: 80,
      format: "jpeg"
    });

    const response = await request(app).get("/video/thumbnail").query({
      url: "https://example.com/video.mp4",
      time: "1",
      width: "120"
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      url: "https://example.com/thumbnails/hash.jpeg",
      key: "thumbnails/hash.jpeg",
      cached: false,
      width: 120,
      height: 80,
      format: "jpeg"
    });
  });

  it("maps BadRequestError to 400", async () => {
    mockedProcessVideoThumbnail.mockRejectedValueOnce(
      new BadRequestError("Requested time is outside video duration")
    );

    const response = await request(app).get("/video/thumbnail").query({
      url: "https://example.com/video.mp4",
      time: "1"
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Requested time is outside video duration");
  });

  it("maps ProcessingError to 500", async () => {
    mockedProcessVideoThumbnail.mockRejectedValueOnce(new ProcessingError("ffmpeg failed"));

    const response = await request(app).get("/video/thumbnail").query({
      url: "https://example.com/video.mp4",
      time: "1"
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("ffmpeg failed");
  });
});
