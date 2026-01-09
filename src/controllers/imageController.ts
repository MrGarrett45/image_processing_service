import { NextFunction, Request, Response } from "express";
import { processImage } from "../services/imageService";
import { validateProcessQuery } from "../utils/validation";

export async function processImageHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const params = await validateProcessQuery(req.query as Record<string, unknown>);
    const result = await processImage(params);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
