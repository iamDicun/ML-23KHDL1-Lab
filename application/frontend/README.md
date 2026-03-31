# Frontend

React application với Tailwind CSS và cấu trúc component/pages.

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Create \`.env\` file:
\`\`\`bash
cp .env.example .env
\`\`\`

3. Edit \`.env\` and add your API key:
\`\`\`
VITE_API_KEY=my_secret_api_key_123
\`\`\`

4. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

5. Open http://localhost:3000

## Build for Production

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Project Structure

\`\`\`
src/
├── pages/              # Page components
├── components/         # Reusable components
├── utils/             # Utility functions
│   └── api.js         # API client with authentication
├── App.jsx            # Main app component
├── main.jsx           # Entry point
└── index.css          # Global styles (Tailwind)
\`\`\`

## Tech Stack

- React 18 - UI library
- Vite - Build tool
- Tailwind CSS - Styling
- React Router DOM - Routing (đã cài đặt, sẵn sàng sử dụng)

## API Integration

Frontend gọi API từ backend với API key authentication (cấu hình trong vite.config.js):
- \`/users\` → \`http://localhost:5000/users\`

### Using API Client

\`\`\`javascript
import { apiClient } from './utils/api'

// Get all users
const users = await apiClient.get('/users')

// Create new user
const newUser = await apiClient.post('/users', {
  name: 'John Doe',
  email: 'john@example.com'
})

// Update user
const updated = await apiClient.put('/users/1', {
  name: 'John Updated'
})

// Delete user
await apiClient.delete('/users/1')
\`\`\`

**Note**: API client tự động thêm header \`x-api-key\` vào mọi request.
