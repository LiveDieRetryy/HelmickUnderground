const defaultAvailability = {
    status: 'accepting',
    message: 'We are currently accepting new work requests.',
    responseTimeframe: 'We typically respond within 24 hours.'
};

const availabilityPresets = {
    accepting: { message: 'We are currently accepting new work requests.', responseTimeframe: 'We typically respond within 24 hours.' },
    busy: { message: 'We currently have limited availability due to scheduled projects, but we welcome future work requests. Send us your project details and we will review them and follow up about upcoming availability.', responseTimeframe: 'We will review your request and follow up as soon as possible.' },
    closed: { message: 'We are currently booked with scheduled projects and are not accepting new work requests at this time. We appreciate your patience and invite you to check back soon.', responseTimeframe: 'For existing projects or urgent questions, please call us directly.' }
};

async function loadAvailabilitySettings() {
    const response = await fetch('/api/contact-submissions?action=availability', { credentials: 'include' });
    const settings = response.ok ? await response.json() : defaultAvailability;
    document.getElementById('availabilityStatus').value = settings.status || defaultAvailability.status;
    document.getElementById('availabilityMessage').value = settings.message || defaultAvailability.message;
    document.getElementById('responseTimeframe').value = settings.responseTimeframe || defaultAvailability.responseTimeframe;
}

document.getElementById('availabilityForm').addEventListener('submit', async event => {
    event.preventDefault();
    const result = document.getElementById('availabilityResult');
    const csrfToken = window.adminAuth?.getCsrfToken();
    const response = await fetch('/api/contact-submissions?action=availability', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrfToken && { 'x-csrf-token': csrfToken }) },
        body: JSON.stringify({
            status: document.getElementById('availabilityStatus').value,
            message: document.getElementById('availabilityMessage').value,
            responseTimeframe: document.getElementById('responseTimeframe').value
        })
    });
    result.textContent = response.ok ? 'Availability saved.' : 'Could not save availability.';
    result.style.color = response.ok ? '#22c55e' : '#ef4444';
});

document.getElementById('availabilityStatus').addEventListener('change', event => {
    const preset = availabilityPresets[event.target.value];
    if (!preset) return;
    document.getElementById('availabilityMessage').value = preset.message;
    document.getElementById('responseTimeframe').value = preset.responseTimeframe;
});

loadAvailabilitySettings().catch(() => {});
