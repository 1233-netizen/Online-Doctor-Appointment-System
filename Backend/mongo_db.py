
import os
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

# Find the main project folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

# Connect to MongoDB
client = MongoClient(os.getenv("MONGO_URI"))

# Select the database and collection
mongo_db = client[os.getenv("MONGO_DB_NAME")]
activity_logs = mongo_db["activity_logs"]


# Function to save patient activities in MongoDB
def log_activity(
    event_type,
    patient_id,
    description,
    appointment_id=None,
    patient_name=None,
    doctor_name=None
):
    log = {
        "event_type": event_type,
        "patient_id": patient_id,
        "patient_name": patient_name,
        "doctor_name": doctor_name,
        "appointment_id": appointment_id,
        "description": description,
        "created_at": datetime.now(timezone.utc)
    }

    # Insert the activity record into MongoDB
    activity_logs.insert_one(log)


# Check MongoDB connection
try:
    client.admin.command("ping")
    print("MongoDB connected successfully!")

except Exception as e:
    print("MongoDB connection failed:", e)

