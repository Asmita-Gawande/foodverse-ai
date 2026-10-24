# FoodVerse AI - Multimodal Food Intelligence Agent

An AI web app that analyses food photos and text to give nutrition estimates, freshness checks,
kitchen hygiene scores, cooking help and personalised meal plans.

## Tech stack
- Frontend: React (loaded from CDN), HTML, CSS (with animations), JavaScript
- Backend: Python, FastAPI
- AI: Google Gemini API (vision + language)

## Features (mapped to project epics)
1. Environment setup and requirements
2. Food recognition and nutrition analysis (`/api/analyze-food`)
3. Freshness and spoilage detection (`/api/freshness`)
4. Restaurant hygiene monitoring and smart cooking assistant (`/api/hygiene`, `/api/cooking-assistant`)
5. Personalised meal planner (`/api/meal-plan`)
6. Web interface, testing and deployment

## How to run
1. Get a free API key at https://aistudio.google.com (Get API key).
2. Open `backend/.env` and replace `paste_your_key_here` with your key.
3. Windows: double-click `run.bat`. Mac/Linux: run `bash run.sh`.
4. Open http://127.0.0.1:8000

API docs are available at http://127.0.0.1:8000/docs
