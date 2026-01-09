import { AppError } from "./AppError";

export class RemoteFetchError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
  }
}
