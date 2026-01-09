import axios from "axios";
import sharp from "sharp";
import { BadRequestError } from "../../src/errors/BadRequestError";
import { ProcessingError } from "../../src/errors/ProcessingError";
import { processVideoThumbnail } from "../../src/services/videoService";
import * as storageService from "../../src/services/storageService";

let lastSeekTime: number | undefined;
let shouldFfmpegError = false;
let ffmpegErrorMessage = "ffmpeg failed";
let ffmpegDuration = 10;

jest.mock("axios");
jest.mock("sharp", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("fluent-ffmpeg", () => {
  type HandlerMap = {
    stderr?: (line: string) => void;
    error?: (error: Error) => void;
  };

  type FfmpegCommand = {
    seekInput: (time: number) => FfmpegCommand;
    outputOptions: () => FfmpegCommand;
    format: () => FfmpegCommand;
    on: (event: string, cb: (arg: any) => void) => FfmpegCommand;
    pipe: (stream: NodeJS.ReadWriteStream) => NodeJS.ReadWriteStream;
  };

  const ffmpegMock = jest.fn((): FfmpegCommand => {
    const handlers: HandlerMap = {};
    const command: FfmpegCommand = {
      seekInput: (time: number) => {
        lastSeekTime = time;
        return command;
      },
      outputOptions: () => command,
      format: () => command,
      on: (event: string, cb: (arg: any) => void) => {
        if (event === "stderr") {
          handlers.stderr = cb as (line: string) => void;
        } else if (event === "error") {
          handlers.error = cb as (error: Error) => void;
        }
        return command;
      },
      pipe: (stream: NodeJS.ReadWriteStream) => {
        if (handlers.stderr) {
          handlers.stderr("stderr line");
        }
        if (shouldFfmpegError && handlers.error) {
          handlers.error(new Error(ffmpegErrorMessage));
          return stream;
        }
        stream.emit("data", Buffer.from("frame"));
        stream.emit("end");
        return stream;
      }
    };
    return command;
  });

  (ffmpegMock as { ffprobe?: unknown }).ffprobe = jest.fn(
    (_path: string, cb: (err: Error | null, metadata: { format: { duration: number } }) => void) => {
      cb(null, { format: { duration: ffmpegDuration } });
    }
  );

  return { __esModule: true, default: ffmpegMock };
});
jest.mock("../../src/services/storageService");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedStorage = storageService as jest.Mocked<typeof storageService>;

describe("videoService.processVideoThumbnail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastSeekTime = undefined;
    shouldFfmpegError = false;
    ffmpegErrorMessage = "ffmpeg failed";
    ffmpegDuration = 10;
  });

  function setupSharpMock() {
    const resizeMock = jest.fn().mockReturnThis();
    const toFormatMock = jest.fn().mockReturnThis();
    const toBufferMock = jest.fn().mockResolvedValue({
      data: Buffer.from("output"),
      info: { width: 120, height: 80 }
    });

    const sharpMock = sharp as unknown as jest.Mock;
    sharpMock.mockImplementation(() => ({
      resize: resizeMock,
      toFormat: toFormatMock,
      toBuffer: toBufferMock
    }));

    return { resizeMock, toFormatMock };
  }

  it("returns cached response when S3 has the object", async () => {
    mockedStorage.getObjectIfExists.mockResolvedValueOnce(true);
    mockedStorage.buildPublicUrl.mockReturnValue("https://example.com/thumbnails/hash.jpeg");

    const result = await processVideoThumbnail({
      url: "https://example.com/video.mp4",
      time: 1
    });

    expect(result.cached).toBe(true);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("extracts a frame and uploads the thumbnail", async () => {
    setupSharpMock();
    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from("video"),
      headers: { "content-type": "video/mp4" }
    });
    mockedStorage.getObjectIfExists.mockResolvedValue(false);
    mockedStorage.uploadObject.mockResolvedValueOnce({
      key: "thumbnails/hash.jpeg",
      url: "https://example.com/thumbnails/hash.jpeg"
    });

    const result = await processVideoThumbnail({
      url: "https://example.com/video.mp4",
      time: 2,
      width: 120
    });

    expect(lastSeekTime).toBe(2);
    expect(result.cached).toBe(false);
    expect(result.format).toBe("jpeg");
    expect(mockedStorage.uploadObject).toHaveBeenCalled();
  });

  it("throws BadRequestError when time exceeds duration", async () => {
    setupSharpMock();
    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from("video"),
      headers: { "content-type": "video/mp4" }
    });
    mockedStorage.getObjectIfExists.mockResolvedValue(false);
    ffmpegDuration = 0.5;

    await expect(
      processVideoThumbnail({
        url: "https://example.com/video.mp4",
        time: 1
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("throws ProcessingError when ffmpeg fails", async () => {
    setupSharpMock();
    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from("video"),
      headers: { "content-type": "video/mp4" }
    });
    mockedStorage.getObjectIfExists.mockResolvedValue(false);
    shouldFfmpegError = true;
    ffmpegErrorMessage = "ffmpeg error";

    await expect(
      processVideoThumbnail({
        url: "https://example.com/video.mp4",
        time: 1
      })
    ).rejects.toBeInstanceOf(ProcessingError);
  });
});
