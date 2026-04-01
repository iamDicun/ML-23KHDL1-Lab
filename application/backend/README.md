# Backend API

Express.js backend server theo kiến trúc MVC (Model-View-Controller).

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Create \`.env\` file:
\`\`\`bash
cp .env.example .env
\`\`\`

3. Edit `.env` and add your configuration:
\`\`\`
PORT=5000
NODE_ENV=development
API_KEY=my_secret_api_key_123
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
DATABASE_URL=postgresql://postgres:your_password@your-project-ref.supabase.co:5432/postgres
DB_HOST=your-project-ref.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password
\`\`\`

4. Initialize database schema:
  - Open Supabase SQL Editor
  - Run `sql/init_schema.sql`

5. Start the server:
\`\`\`bash
npm run dev
\`\`\`

## Project Structure (MVC)

\`\`\`
backend/
├── config/              # Configuration
│   ├── env.js          # Environment variables
│   └── database.js     # Database config
├── controllers/         # Request handlers
│   └── userController.js
├── services/           # Business logic
│   └── userService.js
├── models/             # Data models
│   └── userModel.js
├── routes/             # API routes
│   └── userRoutes.js
├── middlewares/        # Custom middlewares
│   ├── apiKeyAuth.js   # API key authentication
│   └── errorHandler.js
└── server.js           # Entry point
\`\`\`

## Architecture

**MVC Pattern:**
- **Models** (`models/`): Data structure và logic truy cập data
- **Controllers** (`controllers/`): Xử lý HTTP requests và responses
- **Services** (`services/`): Business logic và validation
- **Routes** (`routes/`): Định nghĩa API endpoints
- **Middlewares** (`middlewares/`): Error handling, logging, etc.

**Request Flow:**
```
Request → API Key Auth → Routes → Controller → Service → Model → Database
                                  ↓
Response ← Controller ← Service ← Model ← Database
```

## API Endpoints

**Authentication**: Tất cả endpoints (trừ `GET /`) yêu cầu API key trong header `x-api-key`

### Citizen auth flow (2 bước)
- `POST /cong-dan/dang-nhap/yeu-cau-otp`
  - Body: `{ "sdt": "0901234567", "matKhau": "hashed_pw_2" }`
- `POST /cong-dan/dang-nhap/xac-nhan-otp`
  - Body: `{ "sdt": "0901234567", "otp": "123456" }`
- Response bước 2 trả về `token` (JWT) và `user` để frontend lưu context.

### GET /
Health check endpoint (không cần auth)
\`\`\`json
{
  "message": "Welcome to Express API",
  "version": "1.0.0",
  "environment": "development"
}
\`\`\`

### GET /users
Get all users
\`\`\`json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2026-03-03T00:00:00Z"
  }
]
\`\`\`

### GET /users/:id
Get a single user by ID

### POST /users
Create a new user
\`\`\`json
{
  "name": "John Doe",
  "email": "john@example.com"
}
\`\`\`

### PUT /users/:id
Update a user
\`\`\`json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
\`\`\`

### DELETE /users/:id
Delete a user

## Current State

**Data Storage**: Hiện tại sử dụng in-memory data (array trong `userModel.js`)

**Database Integration**: Sẵn sàng để tích hợp database. Chỉ cần:
1. Update `config/database.js` với connection logic
2. Update `models/userModel.js` để query database thật
3. Không cần thay đổi controllers, services, hoặc routes

## Tech Stack

- Express.js - Web framework
- MVC Pattern - Clean architecture
- PostgreSQL (`pg`) - Database connection
- CORS - Cross-origin resource sharing
- dotenv - Environment variables

## Adding New Features

1. **Add new model**: Create file trong `models/`
2. **Add business logic**: Create service trong `services/`
3. **Add controller**: Create controller trong `controllers/`
4. **Add routes**: Create route file trong `routes/` và import vào `routes/index.js`
5. **Add middleware**: Create middleware trong `middlewares/` nếu cần
