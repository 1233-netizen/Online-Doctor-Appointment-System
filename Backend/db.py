

import mysql.connector
import os
from dotenv import load_dotenv

# Find the main project folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load database settings from the .env file
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)


# Function to connect Python with MySQL
def get_db_connection():
    connection = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT", "3306"))
    )

    return connection
