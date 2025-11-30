const API_URL = 'http://localhost:3000/api';

// Toggle between login and signup forms
const container = document.getElementById('container');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');

showSignup.addEventListener('click', () => {
    container.classList.add('active');
});

showLogin.addEventListener('click', () => {
    container.classList.remove('active');
});

// Form validation
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

// Login form validation and authentication
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let isValid = true;
    
    const email = document.getElementById('loginEmail');
    const password = document.getElementById('loginPassword');
    const emailError = document.getElementById('loginEmailError');
    const passwordError = document.getElementById('loginPasswordError');
    
    // Reset error messages
    emailError.style.display = 'none';
    passwordError.style.display = 'none';
    
    // Email validation
    if (!validateEmail(email.value)) {
        emailError.textContent = 'Please enter a valid email';
        emailError.style.display = 'block';
        isValid = false;
    }
    
    // Password validation
    if (password.value.length < 6) {
        passwordError.textContent = 'Password must be at least 6 characters';
        passwordError.style.display = 'block';
        isValid = false;
    }
    
    if (isValid) {
        try {
            // Show loading state
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Logging in...';
            submitButton.disabled = true;

            // Call login API
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email.value,
                    password: password.value
                })
            });

            const result = await response.json();

            if (result.success) {
                // Store user data in localStorage
                localStorage.setItem('userId', result.user.userId);
                localStorage.setItem('userName', result.user.name);
                localStorage.setItem('userEmail', result.user.email);
                localStorage.setItem('userRole', result.user.role);
                // Redirect to home page
                window.location.href = 'pages/home.html';
            } else {
                // Show error message
                let msg = (result.message ? result.message + ' ' : '') + (result.error || 'Invalid email or password');
                passwordError.textContent = msg.trim();
                passwordError.style.display = 'block';
                // Reset button
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        } catch (error) {
            console.error('Login error:', error);
            passwordError.textContent = 'Unable to connect to server. Please try again.';
            passwordError.style.display = 'block';
            
            // Reset button
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Sign In';
            submitButton.disabled = false;
        }
    }
});

// Signup form validation and registration
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let isValid = true;
    
    const name = document.getElementById('signupName');
    const email = document.getElementById('signupEmail');
    const phoneNum = document.getElementById('signupphone');
    const password = document.getElementById('signupPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    const nameError = document.getElementById('signupNameError');
    const emailError = document.getElementById('signupEmailError');
    const phoneError = document.getElementById('signupPhoneError');
    const passwordError = document.getElementById('signupPasswordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    
    // Reset error messages
    nameError.style.display = 'none';
    emailError.style.display = 'none';
    phoneError.style.display = 'none';
    passwordError.style.display = 'none';
    confirmPasswordError.style.display = 'none';
    
    // Name validation
    if (name.value.trim() === '') {
        nameError.textContent = 'Please enter your name';
        nameError.style.display = 'block';
        isValid = false;
    }

    // Phone Validation
    if (phoneNum.value.trim() !== '' && !isNumeric(phoneNum.value)) {
        phoneError.textContent = 'Phone number must contain only digits';
        phoneError.style.display = 'block';
        isValid = false;
    }
    
    // Email validation
    if (!validateEmail(email.value)) {
        emailError.textContent = 'Please enter a valid email';
        emailError.style.display = 'block';
        isValid = false;
    }
    
    // Password validation
    if (password.value.length < 8) {
        passwordError.textContent = 'Password must be at least 8 characters';
        passwordError.style.display = 'block';
        isValid = false;
    }
    
    // Confirm password validation
    if (password.value !== confirmPassword.value) {
        confirmPasswordError.textContent = 'Passwords do not match';
        confirmPasswordError.style.display = 'block';
        isValid = false;
    }
    
    if (isValid) {
        try {
            // Show loading state
            const submitButton = signupForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Creating account...';
            submitButton.disabled = true;

            // Call registration API
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.value,
                    email: email.value,
                    phone: phoneNum.value || null,
                    password: password.value
                })
            });

            const result = await response.json();

            if (response.status === 409) {
                let msg = (result.message ? result.message + ' ' : '') + (result.error || 'Email already registered');
                emailError.textContent = msg.trim();
                emailError.style.display = 'block';
                submitButton.textContent = originalText;
                submitButton.disabled = false;
                return;
            }

            if (result.success) {
                // Store user data in localStorage (auto-login after signup)
                localStorage.setItem('userId', result.user.userId);
                localStorage.setItem('userName', result.user.name);
                localStorage.setItem('userEmail', result.user.email);
                // Show success message
                alert(result.message || ('Account created successfully! Welcome ' + result.user.name));
                // Redirect to home page
                window.location.href = 'pages/home.html';
            } else {
                // Show error message
                let msg = (result.message ? result.message + ' ' : '') + (result.error || 'Registration failed');
                emailError.textContent = msg.trim();
                emailError.style.display = 'block';
                // Reset button
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }

        } catch (error) {
            console.error('Registration error:', error);
            emailError.textContent = 'Unable to connect to server. Please try again.';
            emailError.style.display = 'block';
            
            // Reset button
            const submitButton = signupForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Sign Up';
            submitButton.disabled = false;
        }
    }
});

// Email validation function
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isNumeric(str) {
    return /^\d+$/.test(str);
}

// Social login buttons (placeholder functionality)
const socialButtons = document.querySelectorAll('.social-btn');
socialButtons.forEach(button => {
    button.addEventListener('click', () => {
        const platform = button.querySelector('i').className.split(' ')[1].split('-')[1];
        alert(`${platform.charAt(0).toUpperCase() + platform.slice(1)} login not implemented yet`);
    });
});

// Testing button to navigate to next page (for development only)
const testButton = document.getElementById('testButton');
if (testButton) {
    testButton.addEventListener('click', () => {
        window.location.href = 'pages/home.html';
    });
}

// Pre-check email availability on blur
let emailCheckAbort;
document.getElementById('signupEmail').addEventListener('blur', async () => {
    const email = document.getElementById('signupEmail').value.trim();
    const emailError = document.getElementById('signupEmailError');
    emailError.style.display = 'none';
    if (!validateEmail(email)) return;

    try {
        if (emailCheckAbort) emailCheckAbort.abort();
        emailCheckAbort = new AbortController();

        const resp = await fetch(`${API_URL}/users/check-email?email=${encodeURIComponent(email)}`, {
            signal: emailCheckAbort.signal
        });
        const data = await resp.json();
        if (!data.available) {
            let msg = (data.message ? data.message + ' ' : '') + (data.error || 'Email already registered');
            emailError.textContent = msg.trim();
            emailError.style.display = 'block';
        }
    } catch (_) { /* ignore */ }
});
