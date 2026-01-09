import request from "supertest";
import { app } from "../../src/app";
import { BadRequestError } from "../../src/errors/BadRequestError";
import { RemoteFetchError } from "../../src/errors/RemoteFetchError";
import { UnsupportedMediaError } from "../../src/errors/UnsupportedMediaError";
import { processImage } from "../../src/services/imageService";

jest.mock("../../src/services/imageService", () => ({
  processImage: jest.fn()
}));

const mockedProcessImage = processImage as jest.MockedFunction<typeof processImage>;

describe("GET /process", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when url is missing", async () => {
    const response = await request(app).get("/process");
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/url is required/i);
    expect(mockedProcessImage).not.toHaveBeenCalled();
  });

  it("returns 200 on success", async () => {
    mockedProcessImage.mockResolvedValueOnce({
      url: "https://example.com/images/hash.webp",
      key: "images/hash.webp",
      cached: false,
      width: 120,
      height: 80,
      format: "webp"
    });

    const response = await request(app).get("/process").query({
      url: "https://example.com/image.png",
      width: "120",
      height: "80",
      format: "webp"
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      url: "https://example.com/images/hash.webp",
      key: "images/hash.webp",
      cached: false,
      width: 120,
      height: 80,
      format: "webp"
    });
  });

  it("maps UnsupportedMediaError to 415", async () => {
    mockedProcessImage.mockRejectedValueOnce(new UnsupportedMediaError("Not an image"));

    const response = await request(app).get("/process").query({
      url: "https://example.com/image.png"
    });

    expect(response.status).toBe(415);
    expect(response.body.error).toBe("Not an image");
  });

  it("maps RemoteFetchError to 502", async () => {
    mockedProcessImage.mockRejectedValueOnce(new RemoteFetchError("Bad gateway", 502));

    const response = await request(app).get("/process").query({
      url: "https://example.com/image.png"
    });

    expect(response.status).toBe(502);
    expect(response.body.error).toBe("Bad gateway");
  });

  it("maps BadRequestError to 400", async () => {
    mockedProcessImage.mockRejectedValueOnce(new BadRequestError("Invalid width"));

    const response = await request(app).get("/process").query({
      url: "https://example.com/image.png",
      width: "120"
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid width");
  });
});
