
let currentPatientId = localStorage.getItem("patientId");
let currentPatientName = localStorage.getItem("patientName");

document.addEventListener("DOMContentLoaded", function () {
    if (currentPatientId) {
        openDashboard();
    } else {
        showAuth("login");
    }
});

// SWITCH LOGIN AND REGISTER

function showAuth(type) {
    document.getElementById("loginForm").style.display =
        type === "login" ? "block" : "none";

    document.getElementById("registerForm").style.display =
        type === "register" ? "block" : "none";

    document.getElementById("loginTab").classList.toggle("active", type === "login");
    document.getElementById("registerTab").classList.toggle("active", type === "register");

    document.getElementById("authMessage").innerText = "";
}

// SHOW MESSAGE

function showMessage(message, error = false) {
    const element = document.getElementById("dashboardMessage");
    element.innerText = message;
    element.style.color = error ? "#d63031" : "#087e8b";
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

            localStorage.setItem("patientId", currentPatientId);
            localStorage.setItem("patientName", currentPatientName);

            openDashboard();
        } else {
            document.getElementById("authMessage").innerText =
                result.message || "Invalid email or password.";
        }

    } catch(error) {
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

    } catch(error) {
        document.getElementById("authMessage").innerText =
            "Unable to connect to server.";
    }
});

// OPEN DASHBOARD AFTER LOGIN

function openDashboard() {
    document.getElementById("authPage").style.display = "none";
    document.getElementById("dashboardPage").style.display = "block";

    document.getElementById("patientName").innerText = currentPatientName;
    document.getElementById("topPatientName").innerText = currentPatientName;

    document.getElementById("profileName").innerText = currentPatientName;
    document.getElementById("profileId").innerText = "Patient ID: " + currentPatientId;

    showSection("homeSection");
    loadDoctors();
    loadAppointments();
}

// NAVIGATION BETWEEN DASHBOARD SECTIONS

function showSection(sectionId) {
    document.querySelectorAll(".dashboard-section").forEach(section => {
        section.style.display = "none";
    });

    document.getElementById(sectionId).style.display = "block";

    document.querySelectorAll(".menu-btn").forEach(button => {
        button.classList.remove("active");
    });

    const buttons = document.querySelectorAll(".menu-btn");
    const sectionIds = [
        "homeSection",
        "doctorsSection",
        "bookingSection",
        "appointmentsSection",
        "profileSection"
    ];

    const index = sectionIds.indexOf(sectionId);

    if (index !== -1) {
        buttons[index].classList.add("active");
    }
}

// LOGOUT

function logout() {
    localStorage.removeItem("patientId");
    localStorage.removeItem("patientName");

    currentPatientId = null;
    currentPatientName = null;

    document.getElementById("dashboardPage").style.display = "none";
    document.getElementById("authPage").style.display = "flex";

    document.getElementById("loginForm").reset();
    showAuth("login");
}

// LOAD DOCTORS

async function loadDoctors() {
    try {
        const response = await fetch("/doctors");
        const doctors = await response.json();

        document.getElementById("doctorCount").innerText = doctors.length;

        const list = document.getElementById("doctorList");
        const select = document.getElementById("doctorSelect");

        list.innerHTML = "";
        select.innerHTML = '<option value="">Select a doctor</option>';

        doctors.forEach(doctor => {
            const card = document.createElement("div");
            card.className = "doctor-card";

            card.innerHTML = `
                <div class="doctor-avatar">👨‍⚕️</div>
                <h3>${doctor.full_name}</h3>
                <p>${doctor.specialization_name}</p>
                <p>${doctor.qualification || ""}</p>
                <p>${doctor.experience_years} Years Experience</p>
                <p><strong>Consultation Fee: ₹${doctor.consultation_fee}</strong></p>
                <button class="main-btn" onclick="selectDoctor(${doctor.doctor_id})">
                    Book Appointment
                </button>
            `;

            list.appendChild(card);

            const option = document.createElement("option");
            option.value = doctor.doctor_id;
            option.textContent = doctor.full_name + " - " + doctor.specialization_name;
            select.appendChild(option);
        });

    } catch(error) {
        showMessage("Unable to load doctors.", true);
    }
}

function selectDoctor(doctorId) {
    showSection("bookingSection");
    document.getElementById("doctorSelect").value = doctorId;
    loadSlots();
}

// LOAD AVAILABLE SLOTS

async function loadSlots() {
    const doctorId = document.getElementById("doctorSelect").value;

    if (!doctorId) {
        showMessage("Please select a doctor first.", true);
        return;
    }

    try {
        const response = await fetch("/slots/" + doctorId);
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

    } catch(error) {
        showMessage("Unable to load slots.", true);
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

    } catch(error) {
        showMessage("Unable to book appointment.", true);
    }
}

// LOAD APPOINTMENTS

async function loadAppointments() {
    if (!currentPatientId) return;

    try {
        const response = await fetch("/my-appointments/" + currentPatientId);
        const appointments = await response.json();

        const list = document.getElementById("appointmentList");
        const recent = document.getElementById("recentAppointments");

        list.innerHTML = "";
        recent.innerHTML = "";

        const active = appointments.filter(a => a.status === "BOOKED");

        document.getElementById("appointmentCount").innerText = appointments.length;
        document.getElementById("bookedCount").innerText = active.length;

        if (appointments.length === 0) {
            list.innerHTML = "<p>No appointments found.</p>";
            recent.innerHTML = "<p>No appointments yet. Book your first appointment!</p>";
            return;
        }

        appointments.forEach((appointment, index) => {
            const card = document.createElement("div");
            card.className = "appointment-card";

            card.innerHTML = `
                <h3>Appointment #${appointment.appointment_id}</h3>
                <p><strong>Doctor:</strong> ${appointment.doctor_name}</p>
                <p><strong>Specialization:</strong> ${appointment.specialization_name}</p>
                <p><strong>Date:</strong> ${appointment.appointment_date}</p>
                <p><strong>Time:</strong> ${appointment.start_time} - ${appointment.end_time}</p>
                <p><strong>Reason:</strong> ${appointment.reason || "Not specified"}</p>
                <p><strong>Status:</strong> ${appointment.status}</p>
                <p><strong>Fee:</strong> ₹${appointment.consultation_fee}</p>
                ${appointment.status === "BOOKED"
                    ? `<button class="cancel-btn" onclick="cancelAppointment(${appointment.appointment_id})">Cancel Appointment</button>`
                    : ""}
            `;

            list.appendChild(card);

            if (index < 2) {
                const recentCard = document.createElement("div");
                recentCard.className = "appointment-card";
                recentCard.innerHTML = `
                    <h3>${appointment.doctor_name}</h3>
                    <p>${appointment.appointment_date} | ${appointment.start_time}</p>
                    <p>Status: ${appointment.status}</p>
                `;
                recent.appendChild(recentCard);
            }
        });

    } catch(error) {
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
            loadAppointments();
            loadDoctors();
        } else {
            showMessage(result.message || "Cancellation failed.", true);
        }

    } catch(error) {
        showMessage("Unable to cancel appointment.", true);
    }
}
