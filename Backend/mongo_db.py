
import os
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH)

# Connect to MongoDB
client = MongoClient(os.getenv("MONGO_URI"))

# Select database
mongo_db = client[os.getenv("MONGO_DB_NAME")]

# Activity logs collection
activity_logs = mongo_db["activity_logs"]


def log_activity(event_type, patient_id, description, appointment_id=None):

    log = {
        "event_type": event_type,
        "patient_id": patient_id,
        "appointment_id": appointment_id,
        "description": description,
        "created_at": datetime.now(timezone.utc)
    }

    activity_logs.insert_one(log)


# Test connection
try:
    client.admin.command("ping")
    print("MongoDB connected successfully!")

except Exception as e:
    print("MongoDB connection failed:", e)
