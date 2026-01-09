import { AppError } from "./AppError";

export class StorageError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}
