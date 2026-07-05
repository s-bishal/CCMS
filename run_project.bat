@echo off
echo ==========================================================
echo    Nepal Engineering College - Complaint Management System
echo                  Mid-Term Defense Demo Startup
echo ==========================================================
echo.
echo Launching Django Backend Server on http://127.0.0.1:8000 ...
start "CCMS Django Backend" cmd /k "cd backend && python manage.py runserver"

echo Launching React Frontend Server (Vite) on http://localhost:5173 ...
start "CCMS Vite Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ----------------------------------------------------------
echo Project has been launched successfully!
echo ----------------------------------------------------------
echo Demo Login Credentials:
echo.
echo   1. Student Portal:
echo      - Email:    student@nec.edu.np
echo      - Password: Password123
echo.
echo   2. Faculty Portal:
echo      - Email:    faculty@nec.edu.np
echo      - Password: Password123
echo.
echo   3. Admin Portal:
echo      - Email:    admin@nec.edu.np
echo      - Password: Password123
echo.
echo   4. Super-Admin Portal:
echo      - Email:    superadmin@nec.edu.np
echo      - Password: Password123
echo ----------------------------------------------------------
echo.
pause
