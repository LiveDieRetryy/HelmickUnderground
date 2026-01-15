// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    
    // Animate hamburger
    hamburger.classList.toggle('active');
});

// Close mobile menu when clicking on a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
    });
});

// Smooth scrolling for navigation links
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

// Navbar background change on scroll
let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');
let scrollTimeout;

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Clear the timeout if it exists
    clearTimeout(scrollTimeout);
    
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
    
    // Show navbar after user stops scrolling for 2 seconds
    scrollTimeout = setTimeout(() => {
        navbar.classList.remove('navbar-hidden');
        navbar.classList.add('navbar-visible');
    }, 2000);
});

// Contact Form Handling
const contactForm = document.getElementById('contactForm');

if (contactForm) {
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
        
        try {
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
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
            } else {
                throw new Error('Form submission failed');
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
