import { StatusCodes as HttpStatus } from "http-status-codes";

export const MIN_HTTP_STATUS_CODE = HttpStatus.CONTINUE;
export const MIN_HTTP_ERROR_STATUS_CODE = HttpStatus.BAD_REQUEST;
// HTTP permits unassigned and extension codes through the end of the 5xx range.
export const MAX_HTTP_STATUS_CODE = 599;
