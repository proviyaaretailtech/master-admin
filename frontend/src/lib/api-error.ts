export interface ApiFieldError {
  field?: string;
  message: string;
}

/**
 * The one error type the API layer throws. `message` stays the server's own (English) text so
 * code that only reads `err.message` keeps working; screens that show errors to people should
 * call `localizeError(err)` from `i18n/errors` instead, which maps `errorCode` / status to the
 * user's language and falls back to this server message for codes it does not know.
 */
export class ApiError extends Error {
  readonly status?: number;
  readonly errorCode?: string;
  readonly fieldErrors: ApiFieldError[];
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    init: {
      status?: number;
      errorCode?: string;
      fieldErrors?: ApiFieldError[];
      isNetworkError?: boolean;
    } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = init.status;
    this.errorCode = init.errorCode;
    this.fieldErrors = init.fieldErrors ?? [];
    this.isNetworkError = Boolean(init.isNetworkError);
  }
}

export const isApiError = (err: unknown): err is ApiError =>
  err instanceof ApiError || (err instanceof Error && err.name === "ApiError");
