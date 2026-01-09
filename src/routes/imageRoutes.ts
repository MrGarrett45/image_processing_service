import { Router } from "express";
import { processImage } from "../services/imageService";
import { processVideoThumbnail } from "../services/videoService";
import {
  parseCrop,
  parseFormat,
  parsePositiveInt,
  parseQuality,
  parseTime,
  validateRemoteUrl
} from "../utils/validation";

const router = Router();

router.get("/process", async (req, res, next) => {
  try {
    const url = await validateRemoteUrl(req.query.url as string | undefined);
    const width = parsePositiveInt(req.query.width as string | undefined, "width");
    const height = parsePositiveInt(req.query.height as string | undefined, "height");
    const format = parseFormat(req.query.format as string | undefined);
    const quality = parseQuality(req.query.quality as string | undefined);
    const crop = parseCrop(req.query.crop as string | undefined);

    const result = await processImage({
      url,
      width,
      height,
      format,
      quality,
      crop
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/video/thumbnail", async (req, res, next) => {
  try {
    const url = await validateRemoteUrl(req.query.url as string | undefined);
    const time = parseTime(req.query.time as string | undefined);
    const width = parsePositiveInt(req.query.width as string | undefined, "width");
    const height = parsePositiveInt(req.query.height as string | undefined, "height");
    const format = parseFormat(req.query.format as string | undefined);
    const quality = parseQuality(req.query.quality as string | undefined);

    const result = await processVideoThumbnail({
      url,
      time,
      width,
      height,
      format,
      quality
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
