import { NextFunction, Request, Response } from "express";
import { processVideoThumbnail } from "../services/videoService";
import { validateVideoThumbnailQuery } from "../utils/validation";

export async function processVideoThumbnailHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const params = await validateVideoThumbnailQuery(req.query as Record<string, unknown>);
    const result = await processVideoThumbnail(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
