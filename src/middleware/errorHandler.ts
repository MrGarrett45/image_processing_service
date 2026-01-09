import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Log unexpected errors for debugging/monitoring.
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
}
