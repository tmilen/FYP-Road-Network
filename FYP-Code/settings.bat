@echo off
echo Setting up Flask environment...

pip install -r requirements.txt

:: Set environment variables
set FLASK_APP=app.py
set FLASK_ENV=development
set FLASK_DEBUG=1

flask run