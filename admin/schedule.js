// Check auth
if (!sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/';
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.href = '/admin/';
});

let currentDate = new Date();
let scheduledAppointments = [];
let currentDayAppointments = []; // Store appointments for currently viewed day

// Load scheduled appointments
async function loadAppointments() {
    try {
        const response = await fetch('/api/contact-submissions?action=all');
        if (!response.ok) throw new Error('Failed to load appointments');
        
        const allSubmissions = await response.json();
        scheduledAppointments = allSubmissions.filter(s => 
            s.status === 'scheduled' && s.scheduled_date
        );
        
        renderCalendar();
        renderAppointmentsList();
    } catch (error) {
        console.error('Error loading appointments:', error);
    }
}

// Render calendar
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update month/year display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayDiv = createDayElement(day, true, year, month - 1);
        calendarDays.appendChild(dayDiv);
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = isCurrentMonth && day === today.getDate();
        const dayDiv = createDayElement(day, false, year, month, isToday);
        calendarDays.appendChild(dayDiv);
    }
    
    // Next month days
    const totalCells = calendarDays.children.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
        const dayDiv = createDayElement(day, true, year, month + 1);
        calendarDays.appendChild(dayDiv);
    }
}

// Create day element
function createDayElement(day, isOtherMonth, year, month, isToday = false) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    if (isOtherMonth) dayDiv.classList.add('other-month');
    if (isToday) dayDiv.classList.add('today');
    
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Find appointments for this day
    const dayAppointments = scheduledAppointments.filter(apt => {
        if (!apt.scheduled_date) return false;
        const aptDate = new Date(apt.scheduled_date).toISOString().split('T')[0];
        return aptDate === dateStr;
    });
    
    dayDiv.innerHTML = `
        <div class="calendar-day-number">${day}</div>
        <div class="calendar-day-appointments">
            ${dayAppointments.map(apt => {
                const time = new Date(apt.scheduled_date).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                });
                return `<div class="appointment-dot" title="${apt.name} - ${time}">${time}</div>`;
            }).join('')}
        </div>
    `;
    
    // Make entire day clickable if it has appointments
    if (dayAppointments.length > 0) {
        dayDiv.style.cursor = 'pointer';
        dayDiv.dataset.dateStr = dateStr; // Store date on element
        dayDiv.addEventListener('click', () => {
            // Look up appointments fresh when clicked to avoid closure issues
            const clickedDateAppointments = scheduledAppointments.filter(apt => {
                if (!apt.scheduled_date) return false;
                const aptDate = new Date(apt.scheduled_date).toISOString().split('T')[0];
                return aptDate === dateStr;
            });
            console.log('Day clicked, appointments found:', clickedDateAppointments);
            showDayAppointments(dateStr, clickedDateAppointments);
        });
    }
    
    return dayDiv;
}

// Show all appointments for a specific day
function showDayAppointments(dateStr, appointments) {
    currentDayAppointments = appointments; // Store for later access
    
    const date = new Date(dateStr + 'T00:00:00');
    const dateFormatted = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    document.getElementById('modalBody').innerHTML = `
        <h3 style="color: var(--primary-color); margin-bottom: 1.5rem;">Appointments for ${dateFormatted}</h3>
        <div style="display: flex; flex-direction: column; gap: 1rem;" id="appointmentsList">
            ${appointments.map(apt => {
                const time = new Date(apt.scheduled_date).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                });
                return `
                    <div class="appointment-card" data-appointment-id="${apt.id}" style="cursor: pointer; transition: all 0.3s ease;">
                        <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                            <div style="flex: 1;">
                                <div style="color: var(--primary-color); font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">${time}</div>
                                <div style="color: var(--white); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem;">${apt.name}</div>
                                <div style="color: var(--gray); font-size: 0.9rem;">${apt.phone || 'No phone'}</div>
                            </div>
                            <div style="color: var(--primary-color); font-size: 1.5rem;">→</div>
                        </div>
                        ${apt.services && apt.services.length > 0 ? `
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                                ${apt.services.map(s => `<span style="background: rgba(255, 107, 26, 0.2); padding: 0.25rem 0.75rem; border-radius: 6px; font-size: 0.85rem;">${s}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Add click listeners to appointment cards
    document.querySelectorAll('#appointmentsList .appointment-card').forEach(card => {
        card.addEventListener('click', () => {
            const appointmentId = parseInt(card.getAttribute('data-appointment-id'));
            console.log('Clicked appointment:', appointmentId);
            viewAppointment(appointmentId);
        });
        card.addEventListener('mouseenter', () => {
            card.style.backgroundColor = 'rgba(255, 107, 26, 0.1)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.backgroundColor = '';
        });
    });
    
    document.getElementById('detailModal').classList.add('active');
}

// View appointment details
function viewAppointment(id) {
    console.log('Looking for appointment with ID:', id, 'Type:', typeof id);
    console.log('Current day appointments:', currentDayAppointments);
    console.log('Available IDs:', currentDayAppointments.map(a => ({ id: a.id, type: typeof a.id })));
    
    // Search in current day appointments first, then fall back to all appointments
    // Use == instead of === to handle type coercion (string '3' vs number 3)
    let appointment = currentDayAppointments.find(a => a.id == id);
    if (!appointment) {
        appointment = scheduledAppointments.find(a => a.id == id);
    }
    
    if (!appointment) {
        console.log('Appointment not found:', id);
        alert('Error: Could not find appointment details. ID: ' + id);
        return;
    }
    
    console.log('Viewing appointment:', appointment);
    
    const dateTime = new Date(appointment.scheduled_date);
    const dateStr = dateTime.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
    
    // Update modal header
    document.querySelector('#detailModal .modal-header h2').textContent = 'Appointment Details';
    
    document.getElementById('modalBody').innerHTML = `
        <div class="detail-section">
            <div class="detail-label">Scheduled Date & Time</div>
            <div class="detail-value" style="color: var(--primary-color); font-size: 1.3rem; font-weight: 700;">${dateStr}</div>
        </div>
        <div class="detail-section">
            <div class="detail-label">Name</div>
            <div class="detail-value">${appointment.name}</div>
        </div>
        <div class="detail-section">
            <div class="detail-label">Email</div>
            <div class="detail-value"><a href="mailto:${appointment.email}" style="color: var(--primary-color);">${appointment.email}</a></div>
        </div>
        <div class="detail-section">
            <div class="detail-label">Phone</div>
            <div class="detail-value"><a href="tel:${appointment.phone}" style="color: var(--primary-color);">${appointment.phone || 'Not provided'}</a></div>
        </div>
        ${appointment.services && appointment.services.length > 0 ? `
            <div class="detail-section">
                <div class="detail-label">Services Requested</div>
                <div class="services-list">
                    ${appointment.services.map(s => `<span class="service-tag">${s}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        <div class="detail-section">
            <div class="detail-label">Message</div>
            <div class="detail-value" style="white-space: pre-wrap;">${appointment.message}</div>
        </div>
        ${appointment.notes ? `
            <div class="detail-section">
                <div class="detail-label">Contact Notes</div>
                <div class="detail-value" style="white-space: pre-wrap; background: rgba(255, 107, 26, 0.1); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--primary-color);">${appointment.notes}</div>
            </div>
        ` : ''}
        ${appointment.ip ? `
            <div class="detail-section">
                <div class="detail-label">IP Address</div>
                <div class="detail-value" style="color: var(--gray); font-size: 0.9rem;">${appointment.ip}</div>
            </div>
        ` : ''}
        <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid rgba(255, 107, 26, 0.2);">
            <a href="/admin/inbox.html" style="display: inline-block; background: linear-gradient(135deg, var(--primary-color) 0%, #ff8c42 100%); color: var(--white); padding: 1rem 2rem; border-radius: 12px; text-decoration: none; font-weight: 700;">
                View in Quote Requests
            </a>
        </div>
    `;
    
    document.getElementById('detailModal').classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('detailModal').classList.remove('active');
}

// Render appointments list
function renderAppointmentsList() {
    const container = document.getElementById('appointmentsList');
    
    if (scheduledAppointments.length === 0) {
        container.innerHTML = '<p style="color: var(--gray);">No scheduled appointments</p>';
        return;
    }
    
    // Sort by date
    const sorted = [...scheduledAppointments].sort((a, b) => 
        new Date(a.scheduled_date) - new Date(b.scheduled_date)
    );
    
    container.innerHTML = sorted.map(apt => {
        const dateTime = new Date(apt.scheduled_date);
        const dateStr = dateTime.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        const timeStr = dateTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit' 
        });
        
        return `
            <div class="appointment-card">
                <div class="appointment-info">
                    <div class="appointment-field">
                        <div class="appointment-label">Date & Time</div>
                        <div class="appointment-time">${dateStr} at ${timeStr}</div>
                    </div>
                    <div class="appointment-field">
                        <div class="appointment-label">Customer</div>
                        <div class="appointment-value">${apt.name}</div>
                    </div>
                    <div class="appointment-field">
                        <div class="appointment-label">Phone</div>
                        <div class="appointment-value"><a href="tel:${apt.phone}" style="color: var(--primary-color);">${apt.phone || 'Not provided'}</a></div>
                    </div>
                    <div class="appointment-field">
                        <div class="appointment-label">Email</div>
                        <div class="appointment-value"><a href="mailto:${apt.email}" style="color: var(--primary-color);">${apt.email}</a></div>
                    </div>
                </div>
                ${apt.services && apt.services.length > 0 ? `
                    <div style="margin-top: 0.5rem;">
                        <div class="appointment-label">Services</div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem;">
                            ${apt.services.map(s => `<span style="background: rgba(255, 107, 26, 0.2); padding: 0.25rem 0.75rem; border-radius: 6px; font-size: 0.85rem; color: var(--white);">${s}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                ${apt.notes ? `
                    <div style="margin-top: 0.5rem;">
                        <div class="appointment-label">Notes</div>
                        <div class="appointment-value" style="color: var(--gray); font-size: 0.9rem;">${apt.notes}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Navigation
function previousMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
}

function goToToday() {
    currentDate = new Date();
    renderCalendar();
}

// Auto-refresh every 30 seconds
setInterval(loadAppointments, 30000);

// Close modal on outside click
document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') {
        closeModal();
    }
});

// Initial load
loadAppointments();
