
import mysql.connector
import os
from dotenv import load_dotenv

# Load .env from the main project folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH)
print("ENV file path:", ENV_PATH)
print("ENV file exists:", os.path.exists(ENV_PATH))
print("Username loaded:", os.getenv("DB_USER"))
print("Database loaded:", os.getenv("DB_NAME"))
print("Port loaded:", os.getenv("DB_PORT"))

print("ENV file found:", os.path.exists(ENV_PATH))
print("DB_PORT loaded:", os.getenv("DB_PORT"))

def get_db_connection():
    connection = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT", "3306"))
    )
    return connection

try:
    db = get_db_connection()

    print("MySQL Connected Successfully!")

    cursor = db.cursor()
    cursor.execute("SHOW TABLES")

    tables = cursor.fetchall()

    print("\nTables in our database:")

    for table in tables:
        print(table[0])

    cursor.close()
    db.close()

except mysql.connector.Error as error:
    print("Connection Error:", error)


from flask import Flask, jsonify
from db import get_db_connection

app = Flask(__name__)

@app.route("/")
def home():
    return "Online Doctor Appointment Booking System Backend is Running!"

@app.route("/doctors")
def get_doctors():

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT doctors.doctor_id,
               doctors.full_name,
               doctors.qualification,
               doctors.experience_years,
               doctors.consultation_fee,
               specializations.specialization_name
        FROM doctors
        JOIN specializations
        ON doctors.specialization_id =
           specializations.specialization_id
    """)

    doctors = cursor.fetchall()

    cursor.close()
    db.close()

    return jsonify(doctors)


if __name__ == "__main__":
    app.run(debug=True)
