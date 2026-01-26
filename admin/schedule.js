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
                return `<div class="appointment-dot" onclick="viewAppointment(${apt.id})" title="${apt.name} - ${time}">${time}</div>`;
            }).join('')}
        </div>
    `;
    
    return dayDiv;
}

// View appointment details
function viewAppointment(id) {
    const appointment = scheduledAppointments.find(a => a.id === id);
    if (!appointment) return;
    
    const dateTime = new Date(appointment.scheduled_date);
    const dateStr = dateTime.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const timeStr = dateTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
    });
    
    alert(`Appointment Details:

Name: ${appointment.name}
Email: ${appointment.email}
Phone: ${appointment.phone || 'Not provided'}
Date: ${dateStr}
Time: ${timeStr}
Services: ${appointment.services ? appointment.services.join(', ') : 'Not specified'}

Message: ${appointment.message}

${appointment.notes ? 'Notes: ' + appointment.notes : ''}`);
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

// Initial load
loadAppointments();
