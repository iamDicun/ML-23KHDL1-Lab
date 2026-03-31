// Middleware xử lý lỗi tập trung
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message)
  
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

// Middleware xử lý route không tồn tại
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`)
  error.statusCode = 404
  next(error)
}
