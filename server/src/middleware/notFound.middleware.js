// 404 Not Found middleware
import { createNotFoundError } from '../utils/apiError.js';

export const notFoundHandler = (req, res, next) => {
  const error = createNotFoundError(
    `Cannot ${req.method} ${req.originalUrl}`
  );
  next(error);
};

export default notFoundHandler;
