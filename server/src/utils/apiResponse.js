// API Response class for standardized API responses
import { API_RESPONSE_MESSAGES, HTTP_STATUS_CODES } from '../config/constants.js';

export class ApiResponse {
  constructor(
    statusCode = HTTP_STATUS_CODES.OK,
    data = null,
    message = API_RESPONSE_MESSAGES.SUCCESS,
    meta = null
  ) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    this.timestamp = new Date().toISOString();
    
    if (meta) {
      this.meta = meta;
    }
  }

  toJSON() {
    const response = {
      statusCode: this.statusCode,
      success: this.success,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
    };

    // Include meta if present (pagination, etc.)
    if (this.meta) {
      response.meta = this.meta;
    }

    return response;
  }
}

// Factory functions for common responses
export const successResponse = (data, message = API_RESPONSE_MESSAGES.SUCCESS) => {
  return new ApiResponse(HTTP_STATUS_CODES.OK, data, message);
};

export const createdResponse = (data, message = API_RESPONSE_MESSAGES.CREATED) => {
  return new ApiResponse(HTTP_STATUS_CODES.CREATED, data, message);
};

export const noContentResponse = () => {
  return new ApiResponse(HTTP_STATUS_CODES.OK, null, API_RESPONSE_MESSAGES.SUCCESS);
};

export default ApiResponse;
