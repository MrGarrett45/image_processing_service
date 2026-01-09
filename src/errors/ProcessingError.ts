import { AppError } from "./AppError";

export class ProcessingError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}
