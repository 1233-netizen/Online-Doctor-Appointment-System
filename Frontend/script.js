
// Get patient information saved in the browser
let currentPatientId = localStorage.getItem("patientId");
let currentPatientName = localStorage.getItem("patientName");
let currentPatientEmail = localStorage.getItem("patientEmail");


// Show login page or dashboard when website opens
document.addEventListener("DOMContentLoaded", function () {
    if (currentPatientId) {
        openDashboard();
    } else {
        showAuth("login");
    }
});


// Switch between Login and Register
function showAuth(type) {
    document.getElementById("loginForm").style.display =
        type === "login" ? "block" : "none";

    document.getElementById("registerForm").style.display =
        type === "register" ? "block" : "none";

    document.getElementById("loginTab").classList.toggle(
        "active", type === "login"
    );

    document.getElementById("registerTab").classList.toggle(
        "active", type === "register"
    );

    document.getElementById("authMessage").innerText = "";
}


// Display messages
function showMessage(message, error = false) {
    const element = document.getElementById("dashboardMessage");

    element.innerText = message;
    element.style.color = error ? "red" : "#087e8b";
}


// LOGIN
document.getElementById("loginForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const data = {
        email: document.getElementById("loginEmail").value,
        password: document.getElementById("loginPassword").value
    };

    try {
        const response = await fetch("/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            currentPatientId = result.patient.patient_id;
            currentPatientName = result.patient.full_name;
            currentPatientEmail = result.patient.email;

            localStorage.setItem("patientId", currentPatientId);
            localStorage.setItem("patientName", currentPatientName);
            localStorage.setItem("patientEmail", currentPatientEmail);

            openDashboard();

        } else {
            document.getElementById("authMessage").innerText =
                result.message || "Login failed.";
        }

    } catch (error) {
        document.getElementById("authMessage").innerText =
            "Unable to connect to server.";
    }
});


// REGISTER
document.getElementById("registerForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const data = {
        full_name: document.getElementById("regName").value,
        email: document.getElementById("regEmail").value,
        phone: document.getElementById("regPhone").value,
        password: document.getElementById("regPassword").value
    };

    try {
        const response = await fetch("/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById("registerForm").reset();

            showAuth("login");

            document.getElementById("authMessage").innerText =
                "Registration successful! Please login.";

        } else {
            document.getElementById("authMessage").innerText =
                result.message || "Registration failed.";
        }

    } catch (error) {
        document.getElementById("authMessage").innerText =
            "Unable to connect to server.";
    }
});


// OPEN DASHBOARD
function openDashboard() {
    document.getElementById("authPage").style.display = "none";
    document.getElementById("dashboardPage").style.display = "block";

    document.getElementById("patientName").innerText = currentPatientName || "Patient";
    document.getElementById("topPatientName").innerText = currentPatientName || "Patient";

    document.getElementById("profileName").innerText = currentPatientName || "Patient";
    document.getElementById("profileEmail").innerText = currentPatientEmail || "Email not available";
    document.getElementById("profileId").innerText = "Patient ID: " + currentPatientId;

    showSection("homeSection");

    loadDoctors();
    loadAppointments();
}


// NAVIGATION
function showSection(sectionId) {
    document.querySelectorAll(".dashboard-section").forEach(section => {
        section.style.display = "none";
    });

    document.getElementById(sectionId).style.display = "block";

    document.querySelectorAll(".menu-btn").forEach(button => {
        button.classList.remove("active");
    });

    const sectionIds = [
        "homeSection",
        "doctorsSection",
        "bookingSection",
        "appointmentsSection",
        "profileSection"
    ];

    const index = sectionIds.indexOf(sectionId);

    if (index !== -1) {
        document.querySelectorAll(".menu-btn")[index].classList.add("active");
    }

    // Refresh information when opening these sections
    if (sectionId === "doctorsSection") {
        loadDoctors();
    }

    if (sectionId === "appointmentsSection") {
        loadAppointments();
    }
}


// LOGOUT
function logout() {
    localStorage.removeItem("patientId");
    localStorage.removeItem("patientName");
    localStorage.removeItem("patientEmail");

    currentPatientId = null;
    currentPatientName = null;
    currentPatientEmail = null;

    document.getElementById("dashboardPage").style.display = "none";
    document.getElementById("authPage").style.display = "block";

    document.getElementById("loginForm").reset();

    showAuth("login");
}


// LOAD DOCTORS FROM MYSQL THROUGH FLASK
async function loadDoctors() {
    try {
        const response = await fetch("/doctors");

        if (!response.ok) {
            throw new Error("Unable to get doctors");
        }

        const doctors = await response.json();

        document.getElementById("doctorCount").innerText = doctors.length;

        const list = document.getElementById("doctorList");
        const select = document.getElementById("doctorSelect");

        list.innerHTML = "";
        select.innerHTML = '<option value="">Select a doctor</option>';

        if (doctors.length === 0) {
            list.innerText = "No doctors available.";
            return;
        }

        doctors.forEach(doctor => {
            // Create a card for each doctor
            const card = document.createElement("div");
            card.className = "doctor-card";

            const name = document.createElement("h3");
            name.textContent = doctor.full_name;

            const specialization = document.createElement("p");
            specialization.textContent =
                "Specialization: " + (doctor.specialization_name || "Not specified");

            const qualification = document.createElement("p");
            qualification.textContent =
                "Qualification: " + (doctor.qualification || "Not specified");

            const experience = document.createElement("p");
            experience.textContent =
                "Experience: " + doctor.experience_years + " years";

            const fee = document.createElement("p");
            fee.textContent =
                "Consultation Fee: Rs. " + doctor.consultation_fee;

            const bookButton = document.createElement("button");
            bookButton.className = "main-btn";
            bookButton.textContent = "Book Appointment";

            bookButton.onclick = function() {
                selectDoctor(doctor.doctor_id);
            };

            card.appendChild(name);
            card.appendChild(specialization);
            card.appendChild(qualification);
            card.appendChild(experience);
            card.appendChild(fee);
            card.appendChild(bookButton);

            list.appendChild(card);

            // Add doctor to dropdown
            const option = document.createElement("option");
            option.value = doctor.doctor_id;
            option.textContent = doctor.full_name;

            select.appendChild(option);
        });

    } catch (error) {
        showMessage("Unable to load doctors. Check the backend.", true);
    }
}


// SELECT A DOCTOR
function selectDoctor(doctorId) {
    showSection("bookingSection");

    document.getElementById("doctorSelect").value = doctorId;

    loadSlots();
}


// LOAD AVAILABLE SLOTS
async function loadSlots() {
    const doctorId = document.getElementById("doctorSelect").value;

    if (!doctorId) {
        showMessage("Please select a doctor.", true);
        return;
    }

    try {
        const response = await fetch("/slots/" + doctorId);

        if (!response.ok) {
            throw new Error("Unable to load slots");
        }

        const slots = await response.json();

        const select = document.getElementById("slotSelect");

        select.innerHTML = '<option value="">Select a slot</option>';

        slots.forEach(slot => {
            const option = document.createElement("option");

            option.value = slot.slot_id;

            option.textContent =
                slot.appointment_date + " | " +
                slot.start_time + " - " + slot.end_time;

            select.appendChild(option);
        });

        if (slots.length === 0) {
            showMessage("No available slots found.", true);
        } else {
            showMessage("Available slots loaded.");
        }

    } catch (error) {
        showMessage("Unable to load available slots.", true);
    }
}


// BOOK APPOINTMENT
async function bookAppointment() {
    const slotId = document.getElementById("slotSelect").value;
    const reason = document.getElementById("reason").value;

    if (!slotId) {
        showMessage("Please select an appointment slot.", true);
        return;
    }

    try {
        const response = await fetch("/book-appointment", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                patient_id: Number(currentPatientId),
                slot_id: Number(slotId),
                reason: reason
            })
        });

        const result = await response.json();

        if (response.ok) {
            showMessage("Appointment booked successfully! ID: " + result.appointment_id);

            document.getElementById("reason").value = "";
            document.getElementById("slotSelect").innerHTML =
                '<option value="">Select a slot</option>';

            loadAppointments();
            loadDoctors();

        } else {
            showMessage(result.message || "Booking failed.", true);
        }

    } catch (error) {
        showMessage("Unable to book appointment.", true);
    }
}


// LOAD PATIENT APPOINTMENTS
async function loadAppointments() {
    if (!currentPatientId) return;

    try {
        const response = await fetch("/my-appointments/" + currentPatientId);

        if (!response.ok) {
            throw new Error("Unable to load appointments");
        }

        const appointments = await response.json();

        const list = document.getElementById("appointmentList");

        list.innerHTML = "";

        const active = appointments.filter(a => a.status === "BOOKED");

        document.getElementById("appointmentCount").innerText = appointments.length;
        document.getElementById("bookedCount").innerText = active.length;

        if (appointments.length === 0) {
            list.innerText = "No appointments found.";
            return;
        }

        appointments.forEach(appointment => {
            const card = document.createElement("div");
            card.className = "appointment-card";

            const heading = document.createElement("h3");
            heading.textContent = "Appointment #" + appointment.appointment_id;

            const details = document.createElement("div");

            details.innerHTML = `
                <p><strong>Doctor:</strong> ${appointment.doctor_name}</p>
                <p><strong>Specialization:</strong> ${appointment.specialization_name}</p>
                <p><strong>Date:</strong> ${appointment.appointment_date}</p>
                <p><strong>Time:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
                <p><strong>Reason:</strong> ${appointment.reason || "Not specified"}</p>
                <p><strong>Status:</strong> ${appointment.status}</p>
                <p><strong>Fee:</strong> Rs. ${appointment.consultation_fee}</p>
            `;

            card.appendChild(heading);
            card.appendChild(details);

            // Show cancel button only for booked appointments
            if (appointment.status === "BOOKED") {
                const cancelButton = document.createElement("button");

                cancelButton.className = "cancel-btn";
                cancelButton.textContent = "Cancel Appointment";

                cancelButton.onclick = function() {
                    cancelAppointment(appointment.appointment_id);
                };

                card.appendChild(cancelButton);
            }

            list.appendChild(card);
        });

    } catch (error) {
        showMessage("Unable to load appointments.", true);
    }
}


// CANCEL APPOINTMENT
async function cancelAppointment(appointmentId) {
    if (!confirm("Are you sure you want to cancel this appointment?")) {
        return;
    }

    try {
        const response = await fetch("/cancel-appointment", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                appointment_id: appointmentId,
                patient_id: Number(currentPatientId)
            })
        });

        const result = await response.json();

        if (response.ok) {
            showMessage("Appointment cancelled successfully.");

            await loadAppointments();
            await loadDoctors();

            if (document.getElementById("doctorSelect").value) {
                await loadSlots();
            }

        } else {
            showMessage(result.message || "Cancellation failed.", true);
        }

    } catch (error) {
        showMessage("Unable to cancel appointment.", true);
    }
}
