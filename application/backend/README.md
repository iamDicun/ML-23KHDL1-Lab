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
API_KEY=your_secret_api_key_here
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
│   ├── apiKeyAuth.js
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

**Authentication**:
- Tất cả endpoint API (trừ `GET /`) yêu cầu header `x-api-key`.
- Endpoints protected theo JWT + role (cán bộ/công dân).
- Công dân đăng nhập trực tiếp bằng SĐT + mật khẩu để nhận JWT.

### Citizen auth flow
- `POST /cong-dan/dang-nhap`
  - Body: `{ "sdt": "0901234567", "matKhau": "your_password" }`
- Response trả về `token` (JWT) và `user` để frontend lưu context.

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

### AI Reuse import (official only)

Các endpoint dưới đây dùng để chạy pipeline preprocess + import dữ liệu review đã lọc vào DB ngay từ backend.

- `POST /ai-reuse/import/run`
  - Header: `x-api-key`, `Authorization: Bearer <official_token>`
  - Body (optional):
    ```json
    {
      "pythonExecutable": "C:/Users/ADMIN/Documents/GitHub/ML-23KHDL1-Lab/.venv/Scripts/python.exe"
    }
    ```
  - Trả về `job` với trạng thái ban đầu `running`.

- `GET /ai-reuse/import/jobs/latest`
  - Lấy trạng thái job gần nhất.

- `GET /ai-reuse/import/jobs/:jobId`
  - Lấy trạng thái theo `jobId`.

- `GET /ai-reuse/import/stats`
  - Xem số lượng bản ghi đã nhập trong `ai_reuse_hotels`, `ai_reuse_reviews` và job gần nhất.

Lưu ý:
- Cần chạy migration `sql/migration_20260415_ai_reuse_filtered_hotels_reviews.sql` trước khi import.
- Nếu muốn dọn hẳn phần schema business cũ và chỉ giữ hotel/review thực tế, chạy thêm `sql/migration_20260416_hotel_only_cleanup.sql`.
- Script backend sẽ gọi file Python: `data/data_crawl/pipeline/scripts/step6_preprocess_and_import_filtered_hotels_reviews.py`.

### Chạy import bằng script backend (CLI)

Từ thư mục `application/backend`:

```bash
npm run import:ai-reuse
```

Tùy chọn Python executable:

```bash
npm run import:ai-reuse -- --python="C:/path/to/python.exe"
```

Script này dùng 2 file input đã tách:
- `data/data_crawl/hotels_all_reviews_filtered_out_step2_top10.csv`
- `data/data_crawl/reviews_all_filtered_out_step2_top10_no_labels.csv`

và gọi pipeline preprocess+upsert vào `ai_reuse_hotels`, `ai_reuse_reviews`.

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
