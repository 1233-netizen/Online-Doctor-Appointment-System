
from flask import Flask, jsonify, request, send_from_directory
import os
from db import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
from mysql.connector import Error
from mongo_db import log_activity
    
app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "Frontend")

# Function to save activity in MongoDB
def save_activity(event_type, patient_id, description, appointment_id=None):
    try:
        log_activity(
            event_type,
            patient_id,
            description,
            appointment_id
        )
    except Exception as e:
        print("MongoDB logging error:", e)


# Home route
@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/frontend/<path:filename>")
def frontend_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)

# Display all doctors
@app.route("/doctors", methods=["GET"])
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


# Patient registration
@app.route("/register", methods=["POST"])
def register_patient():

    data = request.get_json()

    if not data:
        return jsonify({"message": "Please provide patient details"}), 400

    full_name = data.get("full_name")
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")
    gender = data.get("gender")
    date_of_birth = data.get("date_of_birth")

    if not full_name or not email or not phone or not password:
        return jsonify({
            "message": "Name, email, phone and password are required"
        }), 400

    # Hash the password
    password_hash = generate_password_hash(password)

    db = get_db_connection()
    cursor = db.cursor()

    try:
        query = """
            INSERT INTO patients
            (full_name, email, phone, password_hash, gender, date_of_birth)
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        values = (
            full_name,
            email,
            phone,
            password_hash,
            gender,
            date_of_birth
        )

        cursor.execute(query, values)
        db.commit()

        # Get the newly generated patient ID
        patient_id = cursor.lastrowid

        # Save registration activity in MongoDB
        save_activity(
            "REGISTRATION",
            patient_id,
            "New patient registered"
        )

        return jsonify({
            "message": "Patient registered successfully!",
            "patient_id": patient_id
        }), 201

    except Exception as error:
        db.rollback()

        if getattr(error, "errno", None) == 1062:
            return jsonify({
                "message": "Email or phone number already exists"
            }), 409

        return jsonify({"message": "Registration failed"}), 500

    finally:
        cursor.close()
        db.close()


# Patient login
@app.route("/login", methods=["POST"])
def login_patient():

    data = request.get_json()

    if not data:
        return jsonify({"message": "Please provide login details"}), 400

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT * FROM patients WHERE email = %s",
            (email,)
        )

        patient = cursor.fetchone()

        if patient and check_password_hash(
            patient["password_hash"], password
        ):

            patient_id = patient["patient_id"]

            # Save login activity in MongoDB
            save_activity(
                "LOGIN",
                patient_id,
                "Patient logged in"
            )

            return jsonify({
                "message": "Login successful!",
                "patient": {
                    "patient_id": patient_id,
                    "full_name": patient["full_name"],
                    "email": patient["email"]
                }
            }), 200

        return jsonify({
            "message": "Invalid email or password"
        }), 401

    finally:
        cursor.close()
        db.close()


# View available appointment slots
@app.route("/slots/<int:doctor_id>", methods=["GET"])
def get_available_slots(doctor_id):

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        query = """
            SELECT
                slot_id,
                doctor_id,
                appointment_date,
                start_time,
                end_time,
                slot_status
            FROM doctor_slots
            WHERE doctor_id = %s
            AND slot_status = 'AVAILABLE'
            AND appointment_date >= CURDATE()
            ORDER BY appointment_date, start_time
        """

        cursor.execute(query, (doctor_id,))
        slots = cursor.fetchall()

        # Convert date and time values into strings
        for slot in slots:
            slot["appointment_date"] = str(slot["appointment_date"])
            slot["start_time"] = str(slot["start_time"])
            slot["end_time"] = str(slot["end_time"])

        return jsonify(slots), 200

    finally:
        cursor.close()
        db.close()


# Book an appointment
@app.route("/book-appointment", methods=["POST"])
def book_appointment():

    data = request.get_json()

    if not data:
        return jsonify({"message": "Please provide booking details"}), 400

    patient_id = data.get("patient_id")
    slot_id = data.get("slot_id")
    reason = data.get("reason", "")

    if not patient_id or not slot_id:
        return jsonify({
            "message": "Patient ID and Slot ID are required"
        }), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        # Start database transaction
        db.start_transaction()

        # Check whether patient exists
        cursor.execute(
            "SELECT patient_id FROM patients WHERE patient_id = %s",
            (patient_id,)
        )

        patient = cursor.fetchone()

        if not patient:
            db.rollback()
            return jsonify({"message": "Patient not found"}), 404

        # Lock the selected slot while booking
        cursor.execute("""
            SELECT slot_id, slot_status
            FROM doctor_slots
            WHERE slot_id = %s
            FOR UPDATE
        """, (slot_id,))

        slot = cursor.fetchone()

        if not slot:
            db.rollback()
            return jsonify({"message": "Appointment slot not found"}), 404

        if slot["slot_status"] != "AVAILABLE":
            db.rollback()
            return jsonify({"message": "This slot is already booked"}), 409

        # Insert appointment
        cursor.execute("""
            INSERT INTO appointments
            (patient_id, slot_id, reason, status)
            VALUES (%s, %s, %s, 'BOOKED')
        """, (patient_id, slot_id, reason))

        appointment_id = cursor.lastrowid

        # Update slot status
        cursor.execute("""
            UPDATE doctor_slots
            SET slot_status = 'BOOKED'
            WHERE slot_id = %s
        """, (slot_id,))

        # Save all changes in MySQL
        db.commit()

        # Save booking activity in MongoDB
        save_activity(
            "BOOKING",
            patient_id,
            "Appointment booked successfully",
            appointment_id
        )

        return jsonify({
            "message": "Appointment booked successfully!",
            "appointment_id": appointment_id,
            "patient_id": patient_id,
            "slot_id": slot_id
        }), 201

    except Error as error:
        db.rollback()

        if error.errno == 1062:
            return jsonify({
                "message": "This slot already has an active appointment"
            }), 409

        return jsonify({
            "message": "Booking failed"
        }), 500

    finally:
        cursor.close()
        db.close()


# Cancel an appointment
@app.route("/cancel-appointment", methods=["PUT"])
def cancel_appointment():

    data = request.get_json()

    if not data:
        return jsonify({"message": "Please provide cancellation details"}), 400

    appointment_id = data.get("appointment_id")
    patient_id = data.get("patient_id")

    if not appointment_id or not patient_id:
        return jsonify({
            "message": "Appointment ID and Patient ID are required"
        }), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        db.start_transaction()

        # Find the appointment belonging to this patient
        cursor.execute("""
            SELECT appointment_id, slot_id, status
            FROM appointments
            WHERE appointment_id = %s
            AND patient_id = %s
            FOR UPDATE
        """, (appointment_id, patient_id))

        appointment = cursor.fetchone()

        if not appointment:
            db.rollback()
            return jsonify({"message": "Appointment not found"}), 404

        if appointment["status"] != "BOOKED":
            db.rollback()
            return jsonify({
                "message": "This appointment cannot be cancelled"
            }), 400

        # Lock the corresponding slot
        cursor.execute("""
            SELECT slot_id
            FROM doctor_slots
            WHERE slot_id = %s
            FOR UPDATE
        """, (appointment["slot_id"],))

        slot = cursor.fetchone()

        if not slot:
            db.rollback()
            return jsonify({"message": "Appointment slot not found"}), 404

        # Cancel appointment
        cursor.execute("""
            UPDATE appointments
            SET status = 'CANCELLED'
            WHERE appointment_id = %s
        """, (appointment_id,))

        # Make the slot available again
        cursor.execute("""
            UPDATE doctor_slots
            SET slot_status = 'AVAILABLE'
            WHERE slot_id = %s
        """, (appointment["slot_id"],))

        db.commit()

        # Save cancellation activity in MongoDB
        save_activity(
            "CANCELLATION",
            patient_id,
            "Appointment cancelled successfully",
            appointment_id
        )

        return jsonify({
            "message": "Appointment cancelled successfully!",
            "appointment_id": appointment_id
        }), 200

    except Error:
        db.rollback()
        return jsonify({"message": "Cancellation failed"}), 500

    finally:
        cursor.close()
        db.close()


# View patient appointment history
@app.route("/my-appointments/<int:patient_id>", methods=["GET"])
def get_patient_appointments(patient_id):

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        query = """
            SELECT
                appointments.appointment_id,
                appointments.patient_id,
                doctors.full_name AS doctor_name,
                specializations.specialization_name,
                doctor_slots.appointment_date,
                doctor_slots.start_time,
                doctor_slots.end_time,
                appointments.reason,
                appointments.status,
                doctors.consultation_fee
            FROM appointments
            JOIN doctor_slots
                ON appointments.slot_id = doctor_slots.slot_id
            JOIN doctors
                ON doctor_slots.doctor_id = doctors.doctor_id
            JOIN specializations
                ON doctors.specialization_id =
                   specializations.specialization_id
            WHERE appointments.patient_id = %s
            ORDER BY doctor_slots.appointment_date DESC,
                     doctor_slots.start_time DESC
        """

        cursor.execute(query, (patient_id,))
        appointments = cursor.fetchall()

        # Convert date and time values into JSON-friendly strings
        for appointment in appointments:
            appointment["appointment_date"] = str(
                appointment["appointment_date"]
            )
            appointment["start_time"] = str(
                appointment["start_time"]
            )
            appointment["end_time"] = str(
                appointment["end_time"]
            )

        return jsonify(appointments), 200

    finally:
        cursor.close()
        db.close()


if __name__ == "__main__":
    app.run(debug=True)
