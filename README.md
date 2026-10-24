# 🍽️ FoodVerse AI: Multimodal Food Intelligence Agent

FoodVerse AI is an AI-powered web application that helps users understand food through image-based analysis and intelligent assistance. It brings together food nutrition analysis, freshness and hygiene assessment, cooking guidance, and personalized meal planning in one platform.

🌐 **Live Demo:** https://foodverse-ai-f22a.onrender.com

## ✨ Features

- **Food Nutrition Analysis:** Upload a food image to receive AI-generated insights about the food and its nutritional characteristics.
- **Food Freshness Detection:** Analyze food images to receive an AI-based assessment of freshness.
- **Food Hygiene Assessment:** Get AI-generated observations about visible food hygiene indicators.
- **AI Cooking Assistant:** Explore cooking suggestions, recipes, and food-related guidance.
- **Meal Planner:** Generate meal-planning suggestions with the help of AI.
- **User Authentication:** Register and log in to access the application's protected features.
- **Analysis History:** Save and retrieve previous analyses associated with your account.

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Frontend | React.js, HTML, CSS |
| Backend | Python, FastAPI |
| AI Integration | Google Gemini API |
| Database | MongoDB Atlas |
| Authentication | JWT |
| Password Security | Argon2 password hashing |
| Deployment | Render |
| Version Control | Git and GitHub |

## 🏗️ Application Architecture

1. The user interacts with the React-based frontend.
2. The frontend sends requests to the FastAPI backend.
3. The backend uses the Google Gemini API for supported AI-powered features.
4. MongoDB stores user accounts and analysis history.
5. JWT-based authentication protects user-specific endpoints.
6. Render hosts the application so it can be accessed online.

## 📂 Project Structure

```text
foodverse-ai/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── app.jsx
│   ├── index.html
│   └── styles.css
├── README.md
├── run.bat
├── run.sh
└── .gitignore
```

## ⚙️ Run Locally

### Prerequisites

- Python 3.11 or compatible version
- A Google Gemini API key
- A MongoDB Atlas connection string

### 1. Clone the repository

```bash
git clone https://github.com/Asmita-Gawande/foodverse-ai.git
cd foodverse-ai
```

### 2. Install backend dependencies

```bash
python -m pip install -r backend/requirements.txt
```

### 3. Configure environment variables

Create a `.env` file inside the `backend/` directory and configure the following variables with your own values:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
```

**Security:** Never commit `.env` files, API keys, database credentials, or JWT secrets to GitHub.

### 4. Start the application

From the project root, run:

```bash
uvicorn backend.main:app --reload
```

Open the local URL displayed by Uvicorn in your browser. The default address is usually `http://127.0.0.1:8000`.

## 🔐 Security

- Passwords are hashed rather than stored as plain text.
- JWT tokens are used for authenticated requests.
- User-specific history is associated with authenticated accounts.
- API keys and other sensitive configuration values are stored in environment variables.

## 🚀 Deployment

FoodVerse AI is deployed on Render.

**Live application:** https://foodverse-ai-f22a.onrender.com

## 🎯 Project Objective

The objective of FoodVerse AI is to explore how multimodal AI can make food-related information and assistance more accessible through a single web application.

## 👩‍💻 Developer

Developed as an AI-powered web application project, combining frontend development, backend API design, database integration, authentication, and generative AI.

---

*FoodVerse AI demonstrates the integration of modern web technologies with AI-powered food intelligence.*
