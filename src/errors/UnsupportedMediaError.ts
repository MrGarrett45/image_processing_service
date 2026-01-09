import { AppError } from "./AppError";

export class UnsupportedMediaError extends AppError {
  constructor(message: string) {
    super(message, 415);
  }
}
