/**
 * Main JavaScript for Helmick Underground LLC Website
 * Handles scroll behavior and contact form submission
 */

// ============================================================================
// SMOOTH SCROLLING
// ============================================================================

/**
 * Smooth scrolling for anchor links
 * Accounts for fixed navbar height
 */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = 70; // Height of fixed navbar
            const targetPosition = target.offsetTop - offset;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ============================================================================
// NAVBAR SCROLL BEHAVIOR
// ============================================================================

/**
 * Navbar scroll behavior
 * Auto-hides navbar when scrolling down, shows when scrolling up
 */

// Navbar background change on scroll
let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Only hide/show after scrolling past 100px
    if (scrollTop > 100) {
        if (scrollTop > lastScrollTop) {
            // Scrolling down
            navbar.classList.add('navbar-hidden');
            navbar.classList.remove('navbar-visible');
        } else {
            // Scrolling up
            navbar.classList.remove('navbar-hidden');
            navbar.classList.add('navbar-visible');
        }
    } else {
        // At top of page, always show navbar
        navbar.classList.remove('navbar-hidden');
        navbar.classList.add('navbar-visible');
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});

// ============================================================================
// CONTACT FORM HANDLING
// ============================================================================

/**
 * Contact Form Submission Handler
 * Handles form validation, spam prevention, and submission to both Web3Forms and API
 */
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
    // Set form load timestamp for spam detection
    const formLoadTime = Date.now();
    const timestampField = document.getElementById('form_timestamp');
    if (timestampField) {
        timestampField.value = formLoadTime.toString();
    }
    
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formMessage = document.getElementById('formMessage');
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        
        // Disable button and show loading state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        // Get form data
        const formData = new FormData(contactForm);
        
        // Anti-spam checks
        const honeypot = formData.get('website');
        const formTimestamp = formData.get('form_timestamp');
        const submitTime = Date.now();
        const timeDiff = formTimestamp ? (submitTime - parseInt(formTimestamp)) / 1000 : 0;
        
        // Check reCAPTCHA
        const recaptchaResponse = grecaptcha.getResponse();
        if (!recaptchaResponse) {
            formMessage.innerHTML = `
                <div style="background: rgba(220, 38, 38, 0.2); border: 2px solid #dc2626; color: #ff6b6b; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem; text-align: center;">
                    <strong>✗ Please complete the reCAPTCHA</strong><br>
                    Verify that you're not a robot.
                </div>
            `;
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }
        
        // Check honeypot - if filled, it's a bot
        if (honeypot && honeypot.trim() !== '') {
            console.log('Spam detected: honeypot filled');
            // Fake success to fool bots
            formMessage.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.2); border: 2px solid #22c55e; color: #22c55e; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem; text-align: center;">
                    <strong>✓ Message Sent Successfully!</strong><br>
                    We'll get back to you soon.
                </div>
            `;
            contactForm.reset();
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }
        
        // Check if form was submitted too quickly (less than 2 seconds = likely bot)
        if (timeDiff > 0 && timeDiff < 2) {
            console.log('Spam detected: submitted too quickly');
            formMessage.innerHTML = `
                <div style="background: rgba(220, 38, 38, 0.2); border: 2px solid #dc2626; color: #ff6b6b; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem; text-align: center;">
                    <strong>✗ Please take a moment to review your information</strong><br>
                    The form was submitted too quickly.
                </div>
            `;
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }
        
        // Prepare data for our API
        const servicesSelected = Array.from(formData.getAll('services'));
        const submissionData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            services: servicesSelected,
            message: formData.get('message'),
            timestamp: new Date().toISOString(),
            honeypot: honeypot, // Send to server for logging
            recaptchaToken: recaptchaResponse
        };
        
        try {
            // Create clean FormData for Web3Forms (without spam protection fields)
            const web3FormData = new FormData();
            web3FormData.append('access_key', formData.get('access_key'));
            web3FormData.append('subject', formData.get('subject'));
            web3FormData.append('from_name', formData.get('from_name'));
            
            web3FormData.append('name', formData.get('name'));
            web3FormData.append('email', formData.get('email'));
            web3FormData.append('phone', formData.get('phone'));
            web3FormData.append('message', formData.get('message'));
            
            // Add services as comma-separated string
            const services = Array.from(formData.getAll('services')).join(', ');
            if (services) {
                web3FormData.append('Services Requested', services);
            }
            
            console.log('Submitting to Web3Forms with services:', services);
            
            // Send to both Web3Forms (for email) and our API (for admin inbox)
            const [web3Response, apiResponse] = await Promise.all([
                fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    body: web3FormData
                }),
                fetch('/api/contact-submissions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(submissionData)
                }).catch(err => {
                    console.error('API submission error:', err);
                    return { ok: false, error: err.message }; // Return error object instead of null
                })
            ]);
            
            const web3Data = await web3Response.json();
            console.log('Web3Forms response:', web3Data);
            
            // Try to parse API response if it succeeded
            let apiSuccess = false;
            if (apiResponse && apiResponse.ok) {
                const apiData = await apiResponse.json();
                console.log('Submission saved to admin inbox:', apiData);
                apiSuccess = apiData.success;
            } else {
                console.error('Admin inbox API failed:', apiResponse?.error || 'Unknown error');
            }
            
            // Show success if either Web3Forms OR API succeeded
            if (web3Data.success || apiSuccess) {
                // Success message
                formMessage.innerHTML = `
                    <div style="background: rgba(34, 197, 94, 0.2); border: 2px solid #22c55e; color: #22c55e; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem; text-align: center;">
                        <strong>✓ Message Sent Successfully!</strong><br>
                        We'll get back to you within 24 hours.<br>
                        For urgent matters, call:<br>
                        Tommy: 319-721-9925 | Travis: 319-551-4323
                    </div>
                `;
                contactForm.reset();
                grecaptcha.reset();
            } else {
                throw new Error('Both email and inbox submission failed');
            }
        } catch (error) {
            // Error message
            formMessage.innerHTML = `
                <div style="background: rgba(220, 38, 38, 0.2); border: 2px solid #dc2626; color: #ff6b6b; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem; text-align: center;">
                    <strong>✗ Something went wrong</strong><br>
                    Please call us directly:<br>
                    Tommy: 319-721-9925 | Travis: 319-551-4323<br>
                    Or email: HelmickUnderground@gmail.com
                </div>
            `;
        } finally {
            // Re-enable button
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            
            // Clear message after 10 seconds
            setTimeout(() => {
                formMessage.innerHTML = '';
            }, 10000);
        }
    });
    }
});

// ============================================================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ============================================================================

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe service cards and contact cards
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.service-card, .contact-card, .feature');
    
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
});

// Phone number formatting
const phoneInputs = document.querySelectorAll('input[type="tel"]');

phoneInputs.forEach(input => {
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length > 0) {
            if (value.length <= 3) {
                value = value;
            } else if (value.length <= 6) {
                value = `${value.slice(0, 3)}-${value.slice(3)}`;
            } else {
                value = `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6, 10)}`;
            }
        }
        
        e.target.value = value;
    });
});

// Floating Click-to-Call Button
const floatingCallBtn = document.getElementById('floatingCallBtn');
const callModal = document.getElementById('callModal');

if (floatingCallBtn) {
    floatingCallBtn.addEventListener('click', () => {
        callModal.classList.add('active');
    });
}

function closeCallModal() {
    if (callModal) {
        callModal.classList.remove('active');
    }
}

// Close modal when clicking outside
if (callModal) {
    callModal.addEventListener('click', (e) => {
        if (e.target === callModal) {
            closeCallModal();
        }
    });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('✅ Service Worker registered:', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 Service Worker update found');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available
                            console.log('⚡ New version available! Refresh to update.');
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('❌ Service Worker registration failed:', error);
            });
    });
}

// Show update notification
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: linear-gradient(135deg, #ff6b1a 0%, #ff8f26 100%);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        z-index: 100000;
        display: flex;
        align-items: center;
        gap: 1rem;
        animation: slideUp 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <span style="font-weight: 600;">New version available!</span>
        <button onclick="window.location.reload()" style="
            background: white;
            color: #ff6b1a;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
        ">Refresh</button>
    `;
    
    document.body.appendChild(notification);
}

// ============================================================================
// FEATURED GALLERY SLIDESHOW
// ============================================================================

/**
 * Featured Gallery Slideshow on Home Page
 * Loads and displays featured images from the gallery
 */
let featuredItems = []; // Store featured items globally for modal
let currentModalIndex = 0;
let slideshowInterval = null;

async function loadFeaturedGallery() {
    const container = document.getElementById('featuredGallery');
    if (!container) return; // Only run on pages with the featured gallery
    
    try {
        const response = await fetch('/api/gallery');
        const data = await response.json();
        
        // Filter only featured images (not videos)
        featuredItems = data.items.filter(item => item.featured && item.type === 'image');
        
        if (featuredItems.length === 0) {
            container.innerHTML = '<div class="featured-gallery-empty">No featured images yet</div>';
            return;
        }
        
        // Create slides
        container.innerHTML = featuredItems.map((item, index) => `
            <div class="featured-slide ${index === 0 ? 'active' : ''}" data-index="${index}" style="cursor: pointer;">
                <img src="/${item.image}" alt="${item.title}" loading="${index === 0 ? 'eager' : 'lazy'}">
                <div class="featured-slide-caption">
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                </div>
            </div>
        `).join('');
        
        // Add click handlers to slides
        container.querySelectorAll('.featured-slide').forEach(slide => {
            slide.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                openFeaturedModal(index);
            });
        });
        
        // Auto-rotate slides if more than one
        if (featuredItems.length > 1) {
            startSlideshow();
        }
    } catch (error) {
        console.error('Error loading featured gallery:', error);
        container.innerHTML = '<div class="featured-gallery-empty">Unable to load gallery</div>';
    }
}

function startSlideshow() {
    const container = document.getElementById('featuredGallery');
    if (!container) return;
    
    let currentSlide = 0;
    const slides = container.querySelectorAll('.featured-slide');
    
    slideshowInterval = setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }, 5000); // Change slide every 5 seconds
}

function stopSlideshow() {
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
        slideshowInterval = null;
    }
}

function openFeaturedModal(index) {
    if (featuredItems.length === 0) return;
    
    stopSlideshow(); // Stop slideshow when modal is open
    currentModalIndex = index;
    const modal = document.getElementById('featuredGalleryModal');
    const modalImg = document.getElementById('featuredModalImage');
    const modalTitle = document.getElementById('featuredModalTitle');
    const modalDesc = document.getElementById('featuredModalDescription');
    
    const item = featuredItems[currentModalIndex];
    
    modalImg.src = '/' + item.image;
    modalImg.alt = item.title;
    modalTitle.textContent = item.title;
    modalDesc.textContent = item.description;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
}

function closeFeaturedModal() {
    const modal = document.getElementById('featuredGalleryModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Restart slideshow when modal closes
    if (featuredItems.length > 1) {
        startSlideshow();
    }
}

function navigateFeaturedModal(direction) {
    if (featuredItems.length === 0) return;
    
    currentModalIndex += direction;
    
    // Wrap around
    if (currentModalIndex < 0) {
        currentModalIndex = featuredItems.length - 1;
    } else if (currentModalIndex >= featuredItems.length) {
        currentModalIndex = 0;
    }
    
    const modalImg = document.getElementById('featuredModalImage');
    const modalTitle = document.getElementById('featuredModalTitle');
    const modalDesc = document.getElementById('featuredModalDescription');
    const item = featuredItems[currentModalIndex];
    
    modalImg.src = '/' + item.image;
    modalImg.alt = item.title;
    modalTitle.textContent = item.title;
    modalDesc.textContent = item.description;
}

// Load featured gallery on page load
if (document.getElementById('featuredGallery')) {
    loadFeaturedGallery();
    
    // Set up modal controls
    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('featuredGalleryModal');
        const closeBtn = document.querySelector('.featured-modal-close');
        const prevBtn = document.querySelector('.featured-modal-prev');
        const nextBtn = document.querySelector('.featured-modal-next');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeFeaturedModal);
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => navigateFeaturedModal(-1));
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => navigateFeaturedModal(1));
        }
        
        // Close modal when clicking outside the image
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeFeaturedModal();
                }
            });
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (modal && modal.classList.contains('active')) {
                if (e.key === 'Escape') {
                    closeFeaturedModal();
                } else if (e.key === 'ArrowLeft') {
                    navigateFeaturedModal(-1);
                } else if (e.key === 'ArrowRight') {
                    navigateFeaturedModal(1);
                }
            }
        });
    });
}
