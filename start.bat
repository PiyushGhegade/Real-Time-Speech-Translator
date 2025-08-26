@echo off
echo 🚀 Starting Real-Time Speech Translator...
echo.

echo 📦 Installing dependencies...
call npm install

echo.
echo 🌐 Starting backend server...
start "Backend Server" cmd /k "npm start"

echo.
echo ⏳ Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo.
echo 🎨 Starting frontend development server...
start "Frontend Dev Server" cmd /k "npm run dev"

echo.
echo ✅ Both servers are starting up!
echo.
echo 📱 Frontend will open at: http://localhost:3000
echo 🔧 Backend API at: http://localhost:3000/api
echo 📡 WebSocket at: ws://localhost:3000
echo.
echo 🎬 Use the demo controls to see the app in action!
echo.
pause
