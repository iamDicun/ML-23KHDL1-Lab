# React + Tailwind + Express Project

Full-stack web application với kiến trúc MVC:
- **Frontend**: React 18, Tailwind CSS, Vite
- **Backend**: Node.js, Express (MVC pattern)
- **Database**: Supabase (sẽ được tích hợp sau)

## 📁 Project Structure

```
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── App.jsx       # Main app component
│   │   └── main.jsx      # Entry point
│   └── package.json
│
├── backend/              # Express backend API (MVC)
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── middlewares/     # Custom middlewares
│   ├── server.js        # Entry point
│   └── package.json
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### 1. Setup Backend

\`\`\`bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your configuration (optional for now)

# Start the server
npm run dev
\`\`\`

The backend will run on http://localhost:5000

### 2. Setup Frontend

\`\`\`bash
cd frontend
npm install

# Start the development server
npm run dev
\`\`\`

The frontend will run on http://localhost:3000

## 📚 Available Scripts

### Frontend
- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build
- \`npm run lint\` - Run ESLint

### Backend
- \`npm run dev\` - Start development server with auto-reload
- \`npm start\` - Start production server

## 🛣️ API Endpoints

**Note**: Tất cả API endpoints (trừ `/`) đều yêu cầu API key trong header `x-api-key`

- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

**Hiện tại backend sử dụng in-memory data. Khi tích hợp database, data sẽ được lưu trữ persistent.**

## 🏗️ Backend Architecture (MVC)

```
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
```

## 🔐 Environment Variables

### Backend (.env)
\`\`\`
PORT=5000
NODE_ENV=development
API_KEY=my_secret_api_key_123
SUPABASE_URL=your_supabase_url_when_ready
SUPABASE_SERVICE_KEY=your_supabase_service_key_when_ready
\`\`\`

### Frontend (.env)
\`\`\`
VITE_API_KEY=my_secret_api_key_123
\`\`\`

**Important**: API key phải giống nhau ở cả frontend và backend!

## 🎨 Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router DOM** - Client-side routing (đã cài đặt, chưa sử dụng)
- **API Key Auth** - Xác thực mỗi request

### Backend
- **Express** - Web framework
- **MVC Pattern** - Clean architecture
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## 📖 Learn More

- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Express](https://expressjs.com/)
- [MVC Pattern](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller)

## 📝 License

MIT
