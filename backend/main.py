
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
from pydantic import BaseModel, EmailStr, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from pwdlib import PasswordHash

# ---------- Configuration ----------

BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"

load_dotenv(BACKEND_DIR / ".env")

API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()

client = (
    genai.Client(api_key=API_KEY)
    if API_KEY and API_KEY != "paste_your_key_here"
    else None
)

app = FastAPI(title="FoodVerse AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_IMAGE_BYTES = 8 * 1024 * 1024
password_hasher = PasswordHash.recommended()
bearer = HTTPBearer(auto_error=False)

mongo_client = None
db = None


# ---------- Database ----------

def get_database():
    global mongo_client, db

    if not MONGODB_URI:
        raise HTTPException(
            status_code=503,
            detail="MONGODB_URI is missing from backend/.env",
        )

    if db is None:
        try:
            mongo_client = MongoClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=5000,
            )
            mongo_client.admin.command("ping")
            db = mongo_client["foodverse"]

            db["users"].create_index("email", unique=True)
            db["history"].create_index(
                [("user_id", 1), ("created_at", -1)]
            )
        except Exception:
            mongo_client = None
            db = None
            raise HTTPException(
                status_code=503,
                detail=(
                    "Cannot connect to MongoDB. Check your connection "
                    "string and Atlas network access."
                ),
            )

    return db


# ---------- Authentication ----------

class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


def create_token(user_id):
    if len(JWT_SECRET) < 32:
        raise HTTPException(
            status_code=503,
            detail="JWT_SECRET must contain at least 32 characters.",
        )

    now = datetime.now(timezone.utc)

    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(hours=12),
        },
        JWT_SECRET,
        algorithm="HS256",
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Please log in to continue.",
        )

    if not JWT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="JWT_SECRET is not configured.",
        )

    database = get_database()

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
        )

        user_id = ObjectId(payload["sub"])
        user = database["users"].find_one({"_id": user_id})

        if user is None:
            raise HTTPException(
                status_code=401,
                detail="Account not found. Please log in again.",
            )

        return user

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login token.",
        )


def save_history(user, tool_name, result):
    database = get_database()

    database["history"].insert_one(
        {
            "user_id": user["_id"],
            "tool": tool_name,
            "result": result,
            "created_at": datetime.now(timezone.utc),
        }
    )


# ---------- Gemini and image helpers ----------

async def read_image(file: UploadFile) -> types.Part:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an image file.",
        )

    data = await file.read()

    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Image is too large. Use an image under 8 MB.",
        )

    return types.Part.from_bytes(
        data=data,
        mime_type=file.content_type,
    )


def ask_gemini(parts: list) -> dict:
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is missing from backend/.env.",
        )

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )

        if not response.text:
            raise HTTPException(
                status_code=502,
                detail="The AI returned an empty response.",
            )

        return json.loads(response.text)

    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="The AI returned an unreadable response.",
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="The AI request failed. Check your API configuration and try again.",
        )


# ---------- Public routes ----------

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model": MODEL,
        "api_key_set": client is not None,
    }


@app.post("/api/auth/register")
def register(req: AuthRequest):
    database = get_database()
    email = str(req.email).lower().strip()

    try:
        result = database["users"].insert_one(
            {
                "email": email,
                "password_hash": password_hasher.hash(req.password),
                "created_at": datetime.now(timezone.utc),
            }
        )
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    return {
        "access_token": create_token(result.inserted_id),
        "token_type": "bearer",
        "email": email,
    }


@app.post("/api/auth/login")
def login(req: AuthRequest):
    database = get_database()
    email = str(req.email).lower().strip()

    user = database["users"].find_one({"email": email})

    if not user or not password_hasher.verify(
        req.password, user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password.",
        )

    return {
        "access_token": create_token(user["_id"]),
        "token_type": "bearer",
        "email": email,
    }


@app.get("/api/auth/me")
def who_am_i(user=Depends(get_current_user)):
    return {"email": user["email"]}


@app.get("/api/history")
def get_history(user=Depends(get_current_user)):
    database = get_database()

    records = list(
        database["history"]
        .find({"user_id": user["_id"]})
        .sort("created_at", -1)
        .limit(100)
    )

    output = []

    for record in records:
        output.append(
            {
                "id": str(record["_id"]),
                "tool": record["tool"],
                "result": record["result"],
                "created_at": record["created_at"].isoformat(),
            }
        )

    return output


@app.delete("/api/history/{record_id}")
def delete_history(
    record_id: str,
    user=Depends(get_current_user),
):
    database = get_database()

    try:
        object_id = ObjectId(record_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid history item ID.",
        )

    result = database["history"].delete_one(
        {
            "_id": object_id,
            "user_id": user["_id"],
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="History item not found.",
        )

    return {"deleted": True}


# ---------- Food and nutrition ----------

@app.post("/api/analyze-food")
async def analyze_food(
    image: UploadFile = File(...),
    user=Depends(get_current_user),
):
    img = await read_image(image)

    prompt = """
    Identify every food item visible in this meal photo.
    Estimate nutrition for the visible portions.
    Reply ONLY with JSON in this shape:
    {
      "items": [
        {
          "name": "string",
          "estimated_portion": "string",
          "calories": 0,
          "protein_g": 0,
          "carbs_g": 0,
          "fat_g": 0
        }
      ],
      "total_calories": 0,
      "health_summary": "Two short sentences",
      "disclaimer": "Estimates only, not medical advice."
    }
    If no food is visible, return an empty items list and zero calories.
    """

    result = ask_gemini([img, prompt])
    save_history(user, "Food and nutrition", result)
    return result


# ---------- Freshness check ----------

@app.post("/api/freshness")
async def check_freshness(
    image: UploadFile = File(...),
    user=Depends(get_current_user),
):
    img = await read_image(image)

    prompt = """
    Judge food freshness only from visible signs such as color, mold,
    wilting, texture and bruising. Reply ONLY with JSON:
    {
      "food": "string",
      "freshness_status": "Fresh",
      "confidence_percent": 0,
      "visible_signs": ["string"],
      "recommendation": "string",
      "storage_tip": "string"
    }
    freshness_status must be Fresh, Slightly Aged, or Spoiled.
    State uncertainty when the image is inconclusive.
    """

    result = ask_gemini([img, prompt])
    save_history(user, "Freshness check", result)
    return result


# ---------- Kitchen hygiene ----------

@app.post("/api/hygiene")
async def check_hygiene(
    image: UploadFile = File(...),
    user=Depends(get_current_user),
):
    img = await read_image(image)

    prompt = """
    Audit this kitchen or food preparation image for clean surfaces,
    protective clothing, covered food, cross-contamination, pests and dirt.
    Reply ONLY with JSON:
    {
      "hygiene_score": 0,
      "rating": "Needs Improvement",
      "violations": ["string"],
      "good_practices": ["string"],
      "corrective_actions": ["string"]
    }
    Score must be from 0 to 100.
    """

    result = ask_gemini([img, prompt])
    save_history(user, "Kitchen hygiene", result)
    return result


# ---------- Cooking assistant ----------

@app.post("/api/cooking-assistant")
async def cooking_assistant(
    question: str = Form(...),
    image: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
):
    if not question.strip():
        raise HTTPException(
            status_code=400,
            detail="Please enter a cooking question.",
        )

    parts = []

    if image is not None:
        parts.append(await read_image(image))

    prompt = f"""
    You are a friendly cooking assistant.
    The user asks: {question}
    Use the supplied image if one is provided.
    Reply ONLY with JSON:
    {{
      "answer": "clear helpful answer",
      "steps": ["step 1", "step 2"],
      "safety_tips": ["string"],
      "estimated_time_minutes": 0
    }}
    """

    parts.append(prompt)
    result = ask_gemini(parts)
    save_history(user, "Cooking assistant", result)
    return result


# ---------- Meal planner ----------

class MealPlanRequest(BaseModel):
    goal: str = "balanced eating"
    diet: str = "vegetarian"
    daily_calories: int = 2000
    allergies: List[str] = Field(default_factory=list)
    days: int = 3


@app.post("/api/meal-plan")
def meal_plan(
    req: MealPlanRequest,
    user=Depends(get_current_user),
):
    if not 1 <= req.days <= 7:
        raise HTTPException(
            status_code=400,
            detail="Days must be between 1 and 7.",
        )

    if not 800 <= req.daily_calories <= 5000:
        raise HTTPException(
            status_code=400,
            detail="Daily calories must be between 800 and 5000.",
        )

    prompt = f"""
    Create a {req.days}-day meal plan.
    Goal: {req.goal}.
    Diet type: {req.diet}.
    Target: about {req.daily_calories} calories per day.
    Strictly avoid these allergies: {
        ", ".join(req.allergies) if req.allergies else "none"
    }.
    Prefer simple foods easy to find in India.
    Reply ONLY with JSON:
    {{
      "plan": [
        {{
          "day": 1,
          "meals": [
            {{"meal": "Breakfast", "dish": "string", "calories": 0}},
            {{"meal": "Lunch", "dish": "string", "calories": 0}},
            {{"meal": "Snack", "dish": "string", "calories": 0}},
            {{"meal": "Dinner", "dish": "string", "calories": 0}}
          ],
          "day_total_calories": 0
        }}
      ],
      "tips": ["string"],
      "disclaimer": "General guidance only, not medical advice."
    }}
    """

    result = ask_gemini([prompt])
    save_history(user, "Meal planner", result)
    return result


# ---------- Serve frontend: keep this LAST ----------

app.mount(
    "/",
    StaticFiles(directory=str(FRONTEND_DIR), html=True),
    name="frontend",
)
