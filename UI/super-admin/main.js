// Global Variables
let currentUser = null;
let charts = {};
let currentTheme = 'dark';

// Profile Management Functions
async function loadProfileData() {
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        
        const response = await fetch('http://localhost:8000/users/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
                const profile = result.data;
                
                let displayName = localStorage.getItem('admin_name');
                if (!displayName) {
                    const emailUsername = profile.email.split('@')[0];
                    displayName = emailUsername
                        .split(/[._]/)
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    
                    localStorage.setItem('admin_name', displayName);
                }
                
                updateNameDisplay(displayName);
                updateEmailDisplay(profile.email);
                updateCreatedAtDisplay(profile.created_at);
                updateRoleDisplay(profile.role);
                populateProfileForm(displayName, profile.email, profile.created_at);
                
            } else {
                showToast(result.message || 'Failed to load profile', 'error');
            }
        } else {
            throw new Error('Failed to fetch profile data');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Error loading profile data', 'error');
        loadProfileFromLocalStorage();
    } finally {
        hideLoading();
    }
    
    const profileTheme = document.getElementById('profileTheme');
    if (profileTheme) {
        profileTheme.textContent = currentTheme === 'dark' ? 'Dark' : 'Light';
    }
}

async function updateEmail() {
    const emailInput = document.getElementById('profileEmail');
    
    if (!emailInput) return;
    
    const newEmail = emailInput.value.trim();
    
    if (!newEmail || !validateEmail(newEmail)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://localhost:8000/users/profile/email', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: newEmail
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            localStorage.setItem('user_email', newEmail);
            updateEmailDisplay(newEmail);
            showToast('Email updated successfully!', 'success');
        } else {
            showToast(result.message || 'Failed to update email', 'error');
        }
    } catch (error) {
        console.error('Error updating email:', error);
        showToast('Error updating email', 'error');
    } finally {
        hideLoading();
    }
}

function updateProfileName() {
    const nameInput = document.getElementById('profileName');
    
    if (!nameInput) return;
    
    const newName = nameInput.value.trim();
    
    if (newName) {
        localStorage.setItem('admin_name', newName);
        updateNameDisplay(newName);
        showToast('Display name updated successfully!', 'success');
    } else {
        localStorage.removeItem('admin_name');
        loadProfileData();
        showToast('Display name removed. Using email-based name.', 'info');
    }
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword')?.value;
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all password fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }
    
    if (!validatePasswordStrength(newPassword)) {
        showToast('Password does not meet strength requirements', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://localhost:8000/users/profile/change-password', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showToast('Password changed successfully!', 'success');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            updatePasswordStrength('');
        } else {
            showToast(result.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showToast('Error changing password', 'error');
    } finally {
        hideLoading();
    }
}

// Helper Functions
function updateCheckIcon(element, isValid) {
    if (!element) return;
    
    const icon = element.querySelector('i');
    if (icon) {
        if (isValid) {
            icon.className = 'fas fa-check text-green-400 mr-2 text-xs';
        } else {
            icon.className = 'fas fa-times text-red-400 mr-2 text-xs';
        }
    }
}

function checkPasswordMatch() {
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const matchElement = document.getElementById('passwordMatch');
    const mismatchElement = document.getElementById('passwordMismatch');
    
    if (!newPassword || !confirmPassword) {
        if (matchElement) matchElement.classList.add('hidden');
        if (mismatchElement) mismatchElement.classList.add('hidden');
        return;
    }
    
    if (newPassword === confirmPassword) {
        if (matchElement) {
            matchElement.classList.remove('hidden');
            if (mismatchElement) mismatchElement.classList.add('hidden');
        }
    } else {
        if (mismatchElement) {
            if (matchElement) matchElement.classList.add('hidden');
            mismatchElement.classList.remove('hidden');
        }
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const button = input.nextElementSibling;
    if (!button) return;
    
    const icon = button.querySelector('i');
    if (!icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function updateNameDisplay(name) {
    const nameElements = [
        document.getElementById('adminName'),
        document.getElementById('mobileAdminName'),
        document.getElementById('dropdownAdminName'),
        document.getElementById('profileDisplayName'),
        document.getElementById('sectionSubtitle')
    ];
    
    nameElements.forEach(el => {
        if (el) {
            if (el.id === 'sectionSubtitle') {
                el.textContent = `Welcome back, ${name}`;
            } else {
                el.textContent = name;
            }
        }
    });
}

function updateEmailDisplay(email) {
    const emailElements = [
        document.getElementById('dropdownAdminEmail'),
        document.getElementById('profileEmail'),
        document.getElementById('profileDisplayEmail')
    ];
    
    emailElements.forEach(el => {
        if (el) el.textContent = email;
    });
}

function updateCreatedAtDisplay(createdAt) {
    const createdAtElement = document.getElementById('profileCreatedAt');
    if (createdAtElement) {
        createdAtElement.textContent = createdAt;
    }
}

function updateRoleDisplay(role) {
    const roleElements = document.querySelectorAll('.text-indigo-300');
    roleElements.forEach(el => {
        if (el && el.textContent.includes('Super Admin')) {
            el.textContent = role;
        }
    });
}

function populateProfileForm(name, email, createdAt) {
    const profileNameInput = document.getElementById('profileName');
    const profileEmailInput = document.getElementById('profileEmail');
    const profileCreatedAtInput = document.getElementById('profileCreatedAt');
    
    if (profileNameInput) profileNameInput.value = name || '';
    if (profileEmailInput) profileEmailInput.value = email || '';
    if (profileCreatedAtInput) profileCreatedAtInput.textContent = createdAt || 'N/A';
}

function loadProfileFromLocalStorage() {
    const savedName = localStorage.getItem('admin_name');
    const adminEmail = localStorage.getItem('user_email') || 'admin@neuroface.ai';
    
    let displayName = savedName;
    if (!displayName) {
        displayName = adminEmail.split('@')[0];
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }
    
    updateNameDisplay(displayName);
    updateEmailDisplay(adminEmail);
}

// Validation Functions
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecial;
}

function updatePasswordStrength(password) {
    const strengthBar = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('passwordStrengthText');
    const checks = {
        length: document.getElementById('lengthCheck'),
        uppercase: document.getElementById('uppercaseCheck'),
        number: document.getElementById('numberCheck'),
        special: document.getElementById('specialCheck')
    };
    
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= minLength;
    
    updateCheckIcon(checks.length, isLongEnough);
    updateCheckIcon(checks.uppercase, hasUpperCase);
    updateCheckIcon(checks.number, hasNumbers);
    updateCheckIcon(checks.special, hasSpecial);
    
    let score = 0;
    if (isLongEnough) score++;
    if (hasUpperCase) score++;
    if (hasNumbers) score++;
    if (hasSpecial) score++;
    
    let strength = 'Weak';
    let color = 'bg-red-500';
    
    if (score >= 4) {
        strength = 'Very Strong';
        color = 'bg-green-500';
    } else if (score >= 3) {
        strength = 'Strong';
        color = 'bg-green-400';
    } else if (score >= 2) {
        strength = 'Medium';
        color = 'bg-yellow-500';
    }
    
    if (strengthBar) {
        strengthBar.className = `h-2 flex-1 rounded-full ${color}`;
        strengthBar.style.width = `${(score / 4) * 100}%`;
    }
    
    if (strengthText) {
        strengthText.textContent = strength;
        strengthText.className = `text-xs ${getStrengthTextColor(score)}`;
    }
    
    return score >= 3;
}

function initializeClock() {
            function updateClock() {
                const now = new Date();
                const timeString = now.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                });
                const dateString = now.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                
            document.getElementById('currentTime').textContent = timeString;
            document.getElementById('currentDate').textContent = dateString;
            }
            
            updateClock();
            setInterval(updateClock, 1000);
        }
document.addEventListener('DOMContentLoaded', initializeClock);

function getStrengthTextColor(score) {
    if (score >= 4) return 'text-green-400';
    if (score >= 3) return 'text-green-300';
    if (score >= 2) return 'text-yellow-400';
    return 'text-red-400';
}

async function exportMyData() {
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://localhost:8000/users/profile/export-data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `neuroface-profile-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast('Data exported successfully!', 'success');
        } else {
            const result = await response.json();
            showToast(result.message || 'Failed to export data', 'error');
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error exporting data', 'error');
    } finally {
        hideLoading();
    }
}


function showDeleteAccountModal() {
    // Create a custom confirmation modal
    const modalHtml = `
        <div id="deleteConfirmModal" class="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4">
            <div class="modal-content rounded-xl w-full max-w-md">
                <div class="p-6 border-b border-red-800">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-exclamation-triangle text-red-400 text-2xl mr-3"></i>
                        <h3 class="text-xl font-bold text-red-400">Delete Account</h3>
                    </div>
                    <p class="text-gray-300 mb-2">This action is <strong class="text-red-400">IRREVERSIBLE</strong> and will permanently delete:</p>
                    <ul class="text-sm text-gray-400 mb-4 ml-4 list-disc">
                        <li>Your account</li>
                        <li>All your personal data</li>
                        <li>Access to all systems</li>
                    </ul>
                </div>
                
                <div class="p-6">
                    <div class="mb-6">
                        <label class="block text-sm font-medium mb-2 text-gray-300">
                            Type <code class="bg-red-900/30 text-red-300 px-2 py-1 rounded">DELETE_MY_ACCOUNT</code> to confirm:
                        </label>
                        <input type="text" id="deleteConfirmationInput" 
                               class="input-dark w-full rounded-lg px-4 py-3 mt-2 border border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500"
                               placeholder="Type DELETE_MY_ACCOUNT here"
                               autocomplete="off">
                        <p class="text-xs text-gray-400 mt-2">
                            This confirms you understand the consequences.
                        </p>
                    </div>
                    
                    <div class="flex justify-end space-x-3">
                        <button type="button" onclick="closeDeleteConfirmModal()" 
                                class="px-6 py-3 rounded-lg glass-card hover:bg-gray-800/50">
                            Cancel
                        </button>
                        <button type="button" onclick="proceedWithDelete()" 
                                id="deleteAccountBtn"
                                class="px-6 py-3 rounded-lg bg-gradient-to-br from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled>
                            <i class="fas fa-trash-alt mr-2"></i>Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // Setup input validation
    const inputField = document.getElementById('deleteConfirmationInput');
    const deleteBtn = document.getElementById('deleteAccountBtn');
    
    inputField.addEventListener('input', function() {
        const isConfirmed = this.value.trim() === 'DELETE_MY_ACCOUNT';
        deleteBtn.disabled = !isConfirmed;
        
        if (isConfirmed) {
            inputField.classList.remove('border-red-500');
            inputField.classList.add('border-green-500');
        } else {
            inputField.classList.remove('border-green-500');
            inputField.classList.add('border-red-500');
        }
    });
    
    // Focus on input field
    setTimeout(() => {
        inputField.focus();
    }, 100);
}

// New function to close the confirmation modal
function closeDeleteConfirmModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal && modal.parentNode) {
        modal.parentNode.remove();
    }
}

async function proceedWithDelete() {
    const confirmationInput = document.getElementById('deleteConfirmationInput');
    const confirmationText = confirmationInput.value.trim();
    
    if (confirmationText !== 'DELETE_MY_ACCOUNT') {
        showToast('Please type DELETE_MY_ACCOUNT exactly as shown', 'error');
        return;
    }
    
    showLoading('Deleting your account...');
    
    try {
        const token = localStorage.getItem('access_token');
        
        // Encode the confirmation for URL
        const encodedConfirmation = encodeURIComponent('DELETE_MY_ACCOUNT');
        
        // Send as query parameter, not request body
        const response = await fetch(
            `http://localhost:8000/users/profile/delete-account?confirmation=${encodedConfirmation}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // No Content-Type needed for query parameters
                }
            }
        );
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error response:', errorText);
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Account deleted successfully. Redirecting...', 'success');
            
            // Clear local storage
            localStorage.clear();
            sessionStorage.clear();
            
            // Close modal
            closeDeleteConfirmModal();
            
            // Redirect after delay
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        } else {
            showToast(result.detail || 'Failed to delete account', 'error');
        }
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast('Error deleting account. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// UI Helper Functions
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    const colors = {
        success: 'bg-green-900/80 border-green-700 text-green-100',
        error: 'bg-red-900/80 border-red-700 text-red-100',
        warning: 'bg-yellow-900/80 border-yellow-700 text-yellow-100',
        info: 'bg-blue-900/80 border-blue-700 text-blue-100'
    };
    
    toast.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg max-w-sm success-toast z-50 border ${colors[type] || colors.info}`;
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${getToastIcon(type)} mr-3"></i>
            <span>${message}</span>
        </div>
    `;
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 5000);
}

function getToastIcon(type) {
    switch(type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

// Profile Section Initialization
function initProfileSection() {
    if (document.getElementById('profileSection')) {
        loadProfileData();
        
        const newPasswordInput = document.getElementById('newPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        
        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', (e) => {
                updatePasswordStrength(e.target.value);
                checkPasswordMatch();
            });
        }
        
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', checkPasswordMatch);
        }
        
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    updateProfileName();
                }
            });
        }
        
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    changePassword();
                }
            });
        }
    }
}

// Section Navigation
function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    
    document.querySelectorAll('[id$="Section"]').forEach(section => {
        section.classList.add('hidden');
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const section = document.getElementById(sectionId + 'Section');
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('fade-in');
    }
    
    const navLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (navLink) {
        navLink.classList.add('active');
    }
    
    const titles = {
        'dashboard': 'Dashboard Overview',
        'institutes': 'Institute Management',
        'users': 'User Management',
        'subscriptions': 'Subscription Plans',
        'ai': 'AI Management',
        'profile': 'My Profile'
    };
    
    const sectionTitle = document.getElementById('sectionTitle');
    if (sectionTitle && titles[sectionId]) {
        sectionTitle.textContent = titles[sectionId];
    }
    
    if (sectionId === 'profile') {
        initProfileSection();
    }
    
    if (sectionId === 'dashboard') {
        console.log('Loading dashboard data immediately...');
        if (charts.registrations) charts.registrations.destroy();
        if (charts.subscription) charts.subscription.destroy();
        if (charts.usage) charts.usage.destroy();
        
        resetDashboardStats();
        loadDashboardData();
        loadCharts();
        loadUsageChart();
       
    }
    
    if (sectionId === 'institutes') {
        loadInstitutes();
    }
    
    if (sectionId === 'users') {
        loadUsers();
    }
}

function resetDashboardStats() {
    const elements = {
        'totalInstitutes': '0',
        'instituteGrowth': '0% growth',
        'totalUsers': '0',
        'userBreakdown': '0 Admin, 0 Faculty, 0 Student',
        'monthlyRevenue': '₹0',
        'revenueGrowth': '0% growth',
        'aiUsage': '0',
        'aiAccuracy': '0% accuracy',
        'activeSubscriptions': '0',
        'subscriptionDistribution': '0 Monthly, 0 Annual',
        'pendingPayments': '0',
        'pendingAmount': '₹0 total',
        'activeInactive': '0 / 0'
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    
    const token = localStorage.getItem('access_token');
    if (!token) {
         window.location.replace('/UI/register.html');
        return;
    }
    
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        toggleTheme();
    }
    
    const themeToggle = document.getElementById('themeToggle');
    const mobileThemeToggle = document.getElementById('mobileThemeToggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    if (mobileThemeToggle) {
        mobileThemeToggle.addEventListener('click', toggleTheme);
    }
    
    loadProfileData();
    showSection('dashboard');
    
    document.addEventListener('click', function(event) {
        const userDropdown = document.getElementById('userDropdown');
        const userButton = document.querySelector('[onclick="toggleUserDropdown()"]');
        
        if (userDropdown && userButton && !userDropdown.contains(event.target) && !userButton.contains(event.target)) {
            userDropdown.classList.add('hidden');
        }
        
        const notificationsPanel = document.getElementById('notificationsPanel');
        const notificationsButton = document.querySelector('[onclick="toggleNotifications()"]');
        
        if (notificationsPanel && notificationsButton && !notificationsPanel.contains(event.target) && !notificationsButton.contains(event.target)) {
            notificationsPanel.classList.add('hidden');
        }
    });
    
    setInterval(() => {
        if (document.getElementById('dashboardSection') && !document.getElementById('dashboardSection').classList.contains('hidden')) {
            loadDashboardData();
        }
    }, 60000);
});

// Theme Toggle
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    const mobileThemeIcon = document.getElementById('mobileThemeToggle')?.querySelector('i');
    const profileTheme = document.getElementById('profileTheme');
    
    if (currentTheme === 'dark') {
        body.classList.remove('dark');
        body.classList.add('light');
        
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
        if (mobileThemeIcon) {
            mobileThemeIcon.classList.remove('fa-moon');
            mobileThemeIcon.classList.add('fa-sun');
        }
        currentTheme = 'light';
    } else {
        body.classList.remove('light');
        body.classList.add('dark');
        
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
        if (mobileThemeIcon) {
            mobileThemeIcon.classList.remove('fa-sun');
            mobileThemeIcon.classList.add('fa-moon');
        }
        currentTheme = 'dark';
    }
    
    localStorage.setItem('theme', currentTheme);
    updateChartsTheme();
    updateDataTablesTheme();
    
    if (profileTheme) {
        profileTheme.textContent = currentTheme === 'dark' ? 'Dark' : 'Light';
    }
}

// Logout Function
function logout() {
    try {
        const token = localStorage.getItem('access_token');
        if (token) {
            fetch('http://localhost:8000/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('admin_name');
        localStorage.removeItem('user_email');
        window.location.replace('/UI/register.html');
    }
}

// Additional UI Functions
function toggleSidebar() {
    const sidebar = document.getElementById('mobileSidebar');
    if (sidebar) {
        sidebar.classList.toggle('hidden');
    }
}

function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

function refreshCharts() {
    loadCharts();
    loadUsageChart();
    showToast('Charts refreshed!', 'success');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Dashboard Data Loading
async function loadDashboardData() {
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        
        const statsResponse = await fetch('http://localhost:8000/api/super-admin/dashboard-stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!statsResponse.ok) {
            if (statsResponse.status === 401) {
                logout();
                return;
            }
            throw new Error('Failed to fetch dashboard stats');
        }
        
        const stats = await statsResponse.json();
        
        const processedStats = {
            ...stats,
            monthly_plan: stats.monthly_plan || stats.basic_plan || 0,
            annual_plan: stats.annual_plan || stats.premium_plan || 0,
            subscriptionDistribution: `${stats.monthly_plan || stats.basic_plan || 0} Monthly, ${stats.annual_plan || stats.premium_plan || 0} Annual`
        };
        
        updateDashboardStats(processedStats);
        
        await loadCharts();
        await loadUsageChart();
        
        
    } catch (error) {
        showToast('Error loading dashboard data: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function updateDashboardStats(stats) {
    const elements = {
        'totalInstitutes': stats.total_institutes || 0,
        'instituteGrowth': `${stats.institute_growth || 0}% growth`,
        'totalUsers': stats.total_users || 0,
        'userBreakdown': `${stats.admin_count || 0} Admin, ${stats.faculty_count || 0} Faculty, ${stats.student_count || 0} Student`,
        'monthlyRevenue': `₹${formatNumber(stats.monthly_revenue || 0)}`,
        'revenueGrowth': `${stats.revenue_growth || 0}% growth`,
        'aiUsage': formatNumber(stats.ai_usage || 0),
        'aiAccuracy': `${stats.ai_accuracy || 0}% accuracy`,
        'activeSubscriptions': stats.active_subscriptions || 0,
        'subscriptionDistribution': `${stats.monthly_plan || 0} Monthly, ${stats.annual_plan || 0} Annual`,
        'pendingPayments': stats.pending_payments || 0,
        'pendingAmount': `₹${formatNumber(stats.pending_amount || 0)} total`,
        'activeInactive': `${stats.active_institutes || 0} / ${stats.inactive_institutes || 0}`
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Load Charts
async function loadCharts() {
    const period = document.getElementById('chartPeriod')?.value || '12';
    const token = localStorage.getItem('access_token');
    
    try {
        const response = await fetch(`http://localhost:8000/api/super-admin/monthly-registrations?months=${period}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            createRegistrationChart(data);
        }
        
        const subResponse = await fetch(`http://localhost:8000/api/super-admin/subscription-distribution`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (subResponse.ok) {
            const subData = await subResponse.json();
            
            let processedData = subData;
            if (subData.labels && subData.labels.some(label => label.includes('Monthly') || label.includes('Annual'))) {
                processedData = {
                    labels: subData.labels.map(label => 
                        label === 'Monthly' ? 'Monthly' : 
                        label === 'Annual' ? 'Annual' : label
                    ),
                    values: subData.values || []
                };
            }
            
            createSubscriptionChart(processedData);
        }
        
    } catch (error) {
        console.error('Error loading charts:', error);
    }
}

function createRegistrationChart(data) {
    const ctx = document.getElementById('registrationsChart')?.getContext('2d');
    if (!ctx) return;
    
    const textColor = currentTheme === 'dark' ? '#e2e8f0' : '#334155';
    const gridColor = currentTheme === 'dark' ? '#334155' : '#e2e8f0';
    
    if (charts.registrations) {
        charts.registrations.destroy();
    }
    
    charts.registrations = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'New Institutes',
                data: data.values || [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#ffffff',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: '#6366f1',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function createSubscriptionChart(data) {
    const ctx = document.getElementById('subscriptionChart')?.getContext('2d');
    if (!ctx) return;

    const textColor = currentTheme === 'dark' ? '#e2e8f0' : '#334155';

    if (charts.subscription) {
        charts.subscription.destroy();
    }


    const colorPalette = [
        '#b3b3bcff', // gray
        '#6a38deff', // violet
        '#22c55e', // green
        '#f59e0b', // amber
        '#ef4444', // red
        '#06b6d4', // cyan
        '#ec4899', // pink
        '#14b8a6'  // teal
    ];

    // Assign colors dynamically per label
    const backgroundColors = (data.labels || []).map(
        (_, index) => colorPalette[index % colorPalette.length]
    );

    charts.subscription = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels || [],
            datasets: [{
                data: data.values || [],
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: currentTheme === 'dark' ? '#1e293b' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        padding: 20,
                        font: { size: 11 },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#ffffff',
                    titleColor: textColor,
                    bodyColor: textColor,
                    callbacks: {
                        label: function (context) {
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = total ? Math.round((value / total) * 100) : 0;
                            return `${context.label}: ${value} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}


// Load Usage Chart
async function loadUsageChart() {
    const period = document.getElementById('usagePeriod')?.value || '30';
    const token = localStorage.getItem('access_token');
    
    try {
        const response = await fetch(`http://localhost:8000/api/super-admin/institute-usage?days=${period}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            createUsageChart(data);
        }
    } catch (error) {
        console.error('Error loading usage chart:', error);
    }
}

function createUsageChart(data) {
    const ctx = document.getElementById('usageChart')?.getContext('2d');
    if (!ctx) return;
    
    const textColor = currentTheme === 'dark' ? '#e2e8f0' : '#334155';
    const gridColor = currentTheme === 'dark' ? '#334155' : '#e2e8f0';
    
    if (charts.usage) {
        charts.usage.destroy();
    }
    
    charts.usage = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'AI Recognitions',
                data: data.values || [],
                backgroundColor: 'rgba(37, 199, 110, 0.7)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#ffffff',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: '#6366f1',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        },
                        maxRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Load Institutes
async function loadInstitutes() {
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        
        // Try the new endpoint first
        const response = await fetch('http://localhost:8000/institutes/', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const institutes = await response.json();
            
            // Clear the section first
            const section = document.getElementById('institutesSection');
            if (section) {
                section.innerHTML = '';
            }
            
            // Render institutes
            renderInstitutesSection(institutes);
            
        } else if (response.status === 404) {
            // Try the old endpoint as fallback
            const fallbackResponse = await fetch('http://localhost:8000/api/super-admin/institutes', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (fallbackResponse.ok) {
                const institutes = await fallbackResponse.json();
                
                // Clear the section first
                const section = document.getElementById('institutesSection');
                if (section) {
                    section.innerHTML = '';
                }
                
                // Render institutes
                renderInstitutesSection(institutes);
            } else {
                throw new Error('Failed to fetch institutes');
            }
        }
    } catch (error) {
        console.error('Error loading institutes:', error);
        showToast('Error loading institutes: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}


 const getSubscriptionClass = (plan) => {
        const planLower = plan?.toLowerCase() || '';
        if (planLower.includes('annual') || planLower.includes('premium')) {
            return 'bg-purple-900/30 text-purple-400';
        } else if (planLower.includes('monthly') || planLower.includes('basic')) {
            return 'bg-blue-900/30 text-blue-400';
        }
        return 'bg-gray-900/30 text-gray-400';
    };
    
    const getSubscriptionDisplayName = (plan) => {
        const planLower = plan?.toLowerCase() || '';
        if (planLower.includes('annual')) return 'Annual';
        if (planLower.includes('monthly')) return 'Monthly';
        if (planLower.includes('premium')) return 'Annual';
        if (planLower.includes('basic')) return 'Monthly';
        return plan || 'N/A';
    };

function renderInstitutesSection(institutes) {
    const section = document.getElementById('institutesSection');
    if (!section) return;
    
    // Clear existing DataTable if it exists
    if ($.fn.DataTable && $.fn.DataTable.isDataTable('#institutesTable')) {
        $('#institutesTable').DataTable().destroy();
        $('#institutesTable').remove();
    }
    
    const monthlyCount = institutes.filter(i => {
        const plan = i.subscription_plan?.toLowerCase() || '';
        return plan.includes('monthly') || plan.includes('basic');
    }).length;
    
    const annualCount = institutes.filter(i => {
        const plan = i.subscription_plan?.toLowerCase() || '';
        return plan.includes('annual') || plan.includes('premium');
    }).length;
    
    section.innerHTML = `
        <div class="mb-6">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h3 class="text-xl font-semibold">All Institutes</h3>
                    <p class="text-gray-400">Manage registered educational institutions</p>
                </div>
                <div class="flex space-x-3">
                    <div class="relative">
                        <input type="text" placeholder="Search institutes..." 
                               class="input-dark rounded-lg pl-10 pr-4 py-2 w-64"
                               id="searchInstitutes">
                        <i class="fas fa-search absolute left-3 top-3 text-gray-500"></i>
                    </div>
                    <button onclick="exportInstitutes()" class="px-4 py-2 rounded-lg border border-green-500 text-green-400 hover:bg-green-900/30">
                        <i class="fas fa-download mr-2"></i>Export
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="glass-card rounded-xl p-4 text-center">
                    <p class="text-gray-400">Active</p>
                    <p class="text-2xl font-bold text-green-400" id="activeCount">${institutes.filter(i => i.is_active).length}</p>
                </div>
                <div class="glass-card rounded-xl p-4 text-center">
                    <p class="text-gray-400">Inactive</p>
                    <p class="text-2xl font-bold text-red-400" id="inactiveCount">${institutes.filter(i => !i.is_active).length}</p>
                </div>
                <div class="glass-card rounded-xl p-4 text-center">
                    <p class="text-gray-400">Annual</p>
                    <p class="text-2xl font-bold text-purple-400" id="annualCount">${annualCount}</p>
                </div>
                <div class="glass-card rounded-xl p-4 text-center">
                    <p class="text-gray-400">Monthly</p>
                    <p class="text-2xl font-bold text-blue-400" id="monthlyCount">${monthlyCount}</p>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full" id="institutesTable">
                    <thead>
                        <tr class="border-b border-gray-800">
                            <th class="text-left py-3 px-4">Institute ID</th>
                            <th class="text-left py-3 px-4">Name</th>
                            <th class="text-left py-3 px-4">Type</th>
                            <th class="text-left py-3 px-4">Students</th>
                            <th class="text-left py-3 px-4">Subscription</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <th class="text-left py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${institutes.map(institute => `
                            <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                                <td class="py-3 px-4 font-mono">${institute.institute_id}</td>
                                <td class="py-3 px-4">
                                    <div class="font-medium">${institute.institute_name}</div>
                                    <div class="text-sm text-gray-400">${institute.email}</div>
                                </td>
                                <td class="py-3 px-4">${institute.institute_type}</td>
                                <td class="py-3 px-4">${institute.student_count.toLocaleString()}</td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded text-xs ${getSubscriptionClass(institute.subscription_plan)}">
                                        ${getSubscriptionDisplayName(institute.subscription_plan)}
                                    </span>
                                </td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded text-xs ${institute.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}">
                                        ${institute.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td class="py-3 px-4">
                                    <div class="flex space-x-2">
                                        <button onclick="viewInstitute('${institute.institute_id}')" class="p-2 rounded-lg hover:bg-gray-800" title="View">
                                            <i class="fas fa-eye text-blue-400"></i>
                                        </button>
                                        <button onclick="editInstitute('${institute.institute_id}')" class="p-2 rounded-lg hover:bg-gray-800" title="Edit">
                                            <i class="fas fa-edit text-yellow-400"></i>
                                        </button>
                                        <button onclick="toggleInstituteStatus('${institute.institute_id}', ${institute.is_active})" class="p-2 rounded-lg hover:bg-gray-800" title="${institute.is_active ? 'Deactivate' : 'Activate'}">
                                            <i class="fas ${institute.is_active ? 'fa-ban text-red-400' : 'fa-check text-green-400'}"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Initialize DataTable after a short delay
    setTimeout(() => {
        if ($.fn.DataTable) {
            // Check if table exists and hasn't been initialized yet
            const table = $('#institutesTable');
            if (table.length && !$.fn.DataTable.isDataTable('#institutesTable')) {
                table.DataTable({
                    pageLength: 10,
                    lengthMenu: [10, 25, 50, 100],
                    order: [[0, 'desc']],
                    language: {
                        search: "",
                        searchPlaceholder: "Search institutes...",
                        lengthMenu: "_MENU_ Entries per page",
                        info: "Showing _START_ to _END_ of _TOTAL_ entries",
                        infoEmpty: "Showing 0 to 0 of 0 entries",
                        infoFiltered: "(filtered from _MAX_ total entries)",
                        paginate: {
                            first: "First",
                            last: "Last",
                            next: "Next",
                            previous: "Previous"
                        }
                    },
                    dom: '<"flex justify-between items-center mb-4"<"flex items-center"l><"flex items-center"f>>rt<"flex justify-between items-center mt-4"<"dataTables_info"i><"dataTables_paginate"p>>',
                    drawCallback: function(settings) {
                        updateDataTablesTheme();
                    }
                });
                
                // Apply theme
                setTimeout(() => {
                    updateDataTablesTheme();
                }, 100);
            }
        }
    }, 100);
}

// =================== INSTITUTE MANAGEMENT FUNCTIONS ===================

// View Institute Details
async function viewInstitute(instituteId) {
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://localhost:8000/institutes/${instituteId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const institute = await response.json();
            showInstituteModal(institute);
        } else if (response.status === 404) {
            showToast('Institute not found', 'error');
        } else {
            throw new Error('Failed to fetch institute details');
        }
    } catch (error) {
        console.error('Error viewing institute:', error);
        showToast('Error loading institute details', 'error');
    } finally {
        hideLoading();
    }
}

// Edit Institute
async function editInstitute(instituteId) {
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://localhost:8000/institutes/${instituteId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const institute = await response.json();
            showEditInstituteModal(institute);
        } else if (response.status === 404) {
            showToast('Institute not found', 'error');
        } else {
            throw new Error('Failed to fetch institute details');
        }
    } catch (error) {
        console.error('Error loading institute for edit:', error);
        showToast('Error loading institute details', 'error');
    } finally {
        hideLoading();
    }
}

// Toggle Institute Status (Activate/Deactivate)
async function toggleInstituteStatus(instituteId, isActive) {
    const action = isActive ? 'deactivate' : 'activate';
    const confirmMessage = isActive 
        ? `Are you sure you want to deactivate institute ${instituteId}? All associated users will also be deactivated.`
        : `Are you sure you want to activate institute ${instituteId}?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        let response;
        
        if (isActive) {
            // Deactivate - DELETE request
            response = await fetch(`http://localhost:8000/institutes/${instituteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
        } else {
            // Activate - PATCH request
            response = await fetch(`http://localhost:8000/institutes/${instituteId}/activate`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(`Institute ${isActive ? 'deactivated' : 'activated'} successfully`, 'success');
            
            // Close any open modals
            closeModal('viewInstituteModal');
            closeModal('editInstituteModal');
            
            // Small delay before refresh to ensure backend processed
            setTimeout(async () => {
                await loadInstitutes();
            }, 500);
            
        } else {
            showToast(result.detail || `Failed to ${action} institute`, 'error');
        }
    } catch (error) {
        console.error(`Error ${action}ing institute:`, error);
        showToast(`Error ${action}ing institute`, 'error');
    } finally {
        hideLoading();
    }
}

// Show Institute Details Modal
function showInstituteModal(institute) {
    // Close any existing modal first
    closeModal('viewInstituteModal');
    closeModal('editInstituteModal');
    
    // Create modal HTML
    const modalHTML = `
        <div id="viewInstituteModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div class="glass-card rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-semibold">Institute Details</h3>
                    <button onclick="closeModal('viewInstituteModal')" class="text-gray-400 hover:text-white">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <div class="space-y-6">
                    <!-- Basic Information -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Institute ID</label>
                            <div class="input-dark rounded-lg px-4 py-2 font-mono">${institute.institute_id}</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Institute Name</label>
                            <div class="input-dark rounded-lg px-4 py-2">${institute.institute_name}</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Email</label>
                            <div class="input-dark rounded-lg px-4 py-2">${institute.email}</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Phone</label>
                            <div class="input-dark rounded-lg px-4 py-2">${institute.phone}</div>
                        </div>
                    </div>
                    
                    <!-- Additional Information -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Institute Type</label>
                            <div class="input-dark rounded-lg px-4 py-2">${institute.institute_type}</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Student Count</label>
                            <div class="input-dark rounded-lg px-4 py-2">${institute.student_count.toLocaleString()}</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Contact Person</label>
                            <div class="input-dark rounded-lg px-4 py-2">${institute.contact_person}</div>
                        </div>
                    </div>
                    
                    <!-- Subscription Information -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Subscription Plan</label>
                            <div class="input-dark rounded-lg px-4 py-2">
                                <span class="px-2 py-1 rounded text-xs ${getSubscriptionClass(institute.subscription_plan)}">
                                    ${getSubscriptionDisplayName(institute.subscription_plan)}
                                </span>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Payment Method</label>
                            <div class="input-dark rounded-lg px-4 py-2">${institute.payment_method || 'N/A'}</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Status</label>
                            <div class="input-dark rounded-lg px-4 py-2">
                                <span class="px-2 py-1 rounded text-xs ${institute.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}">
                                    ${institute.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Address -->
                    <div>
                        <label class="block text-sm font-medium mb-1 text-gray-400">Address</label>
                        <div class="input-dark rounded-lg px-4 py-2">${institute.address}</div>
                    </div>
                    
                    <!-- Dates -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Created At</label>
                            <div class="input-dark rounded-lg px-4 py-2">${formatDateTime(institute.created_at)}</div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 text-gray-400">Last Updated</label>
                            <div class="input-dark rounded-lg px-4 py-2">${institute.updated_at ? formatDateTime(institute.updated_at) : 'Never'}</div>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="flex space-x-3 pt-4 border-t border-gray-800">
                        <button onclick="editInstitute('${institute.institute_id}')" 
                                class="flex-1 px-4 py-2 rounded-lg bg-blue-900/30 text-blue-400 hover:bg-blue-900/50">
                            <i class="fas fa-edit mr-2"></i>Edit Institute
                        </button>
                        <button onclick="toggleInstituteStatus('${institute.institute_id}', ${institute.is_active})" 
                                class="flex-1 px-4 py-2 rounded-lg ${institute.is_active ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'}">
                            <i class="fas ${institute.is_active ? 'fa-ban mr-2' : 'fa-check mr-2'}"></i>
                            ${institute.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onclick="closeModal('viewInstituteModal')" 
                                class="flex-1 px-4 py-2 rounded-lg btn-secondary">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Show Edit Institute Modal
function showEditInstituteModal(institute) {
    // First close any existing modals
    closeModal('viewInstituteModal');
    closeModal('editInstituteModal');
    
    // Create edit modal HTML
    const modalHTML = `
        <div id="editInstituteModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div class="glass-card rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-semibold">Edit Institute</h3>
                    <button onclick="closeModal('editInstituteModal')" class="text-gray-400 hover:text-white">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <form id="editInstituteForm" onsubmit="updateInstitute(event, '${institute.institute_id}')">
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Institute ID</label>
                                <input type="text" value="${institute.institute_id}" disabled
                                       class="input-dark w-full rounded-lg px-4 py-2 bg-gray-800/50 cursor-not-allowed">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Institute Name *</label>
                                <input type="text" id="editInstituteName" required
                                       class="input-dark w-full rounded-lg px-4 py-2"
                                       value="${institute.institute_name}">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Email *</label>
                                <input type="email" id="editInstituteEmail" required
                                       class="input-dark w-full rounded-lg px-4 py-2"
                                       value="${institute.email}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Phone *</label>
                                <input type="text" id="editInstitutePhone" required
                                       class="input-dark w-full rounded-lg px-4 py-2"
                                       value="${institute.phone}">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Institute Type *</label>
                                <select id="editInstituteType" required class="input-dark w-full rounded-lg px-4 py-2">
                                    <option value="University" ${institute.institute_type === 'University' ? 'selected' : ''}>University</option>
                                    <option value="College" ${institute.institute_type === 'College' ? 'selected' : ''}>College</option>
                                    <option value="School" ${institute.institute_type === 'School' ? 'selected' : ''}>School</option>
                                    <option value="Coaching" ${institute.institute_type === 'Coaching' ? 'selected' : ''}>Coaching Center</option>
                                    <option value="Other" ${institute.institute_type === 'Other' ? 'selected' : ''}>Other</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Student Count *</label>
                                <input type="number" id="editStudentCount" required min="0"
                                       class="input-dark w-full rounded-lg px-4 py-2"
                                       value="${institute.student_count}">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Contact Person *</label>
                                <input type="text" id="editContactPerson" required
                                       class="input-dark w-full rounded-lg px-4 py-2"
                                       value="${institute.contact_person}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Subscription Plan *</label>
                                <select id="editSubscriptionPlan" required class="input-dark w-full rounded-lg px-4 py-2">
                                    <option value="Monthly" ${institute.subscription_plan === 'Monthly' ? 'selected' : ''}>Monthly</option>
                                    <option value="Annual" ${institute.subscription_plan === 'Annual' ? 'selected' : ''}>Annual</option>
                                    <option value="Basic" ${institute.subscription_plan === 'Basic' ? 'selected' : ''}>Basic</option>
                                    <option value="Premium" ${institute.subscription_plan === 'Premium' ? 'selected' : ''}>Premium</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Payment Method</label>
                                <select id="editPaymentMethod" class="input-dark w-full rounded-lg px-4 py-2">
                                    <option value="">Select Payment Method</option>
                                    <option value="Credit Card" ${institute.payment_method === 'Credit Card' ? 'selected' : ''}>Credit Card</option>
                                    <option value="Debit Card" ${institute.payment_method === 'Debit Card' ? 'selected' : ''}>Debit Card</option>
                                    <option value="Net Banking" ${institute.payment_method === 'Net Banking' ? 'selected' : ''}>Net Banking</option>
                                    <option value="UPI" ${institute.payment_method === 'UPI' ? 'selected' : ''}>UPI</option>
                                    <option value="Cash" ${institute.payment_method === 'Cash' ? 'selected' : ''}>Cash</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">Status</label>
                                <select id="editInstituteStatus" class="input-dark w-full rounded-lg px-4 py-2">
                                    <option value="true" ${institute.is_active ? 'selected' : ''}>Active</option>
                                    <option value="false" ${!institute.is_active ? 'selected' : ''}>Inactive</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-2">Address *</label>
                            <textarea id="editInstituteAddress" required rows="3"
                                      class="input-dark w-full rounded-lg px-4 py-2">${institute.address}</textarea>
                        </div>
                        
                        <div class="flex space-x-3 pt-4">
                            <button type="submit" 
                                    class="flex-1 px-4 py-2 rounded-lg btn-primary">
                                <i class="fas fa-save mr-2"></i>Save Changes
                            </button>
                            <button type="button" onclick="closeModal('editInstituteModal')"
                                    class="flex-1 px-4 py-2 rounded-lg btn-secondary">
                                Cancel
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Update Institute
async function updateInstitute(event, instituteId) {
    event.preventDefault();
    
    // Get form values
    const updateData = {
        instituteName: document.getElementById('editInstituteName').value.trim(),
        email: document.getElementById('editInstituteEmail').value.trim(),
        phone: document.getElementById('editInstitutePhone').value.trim(),
        instituteType: document.getElementById('editInstituteType').value,
        studentCount: parseInt(document.getElementById('editStudentCount').value),
        contactPerson: document.getElementById('editContactPerson').value.trim(),
        subscriptionPlan: document.getElementById('editSubscriptionPlan').value,
        paymentMethod: document.getElementById('editPaymentMethod').value || null,
        address: document.getElementById('editInstituteAddress').value.trim()
    };
    
    // Validation
    if (!updateData.instituteName || !updateData.email || !updateData.phone || 
        !updateData.instituteType || !updateData.contactPerson || !updateData.address) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (updateData.studentCount < 0) {
        showToast('Student count cannot be negative', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://localhost:8000/institutes/${instituteId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('Institute updated successfully', 'success');
            closeModal('editInstituteModal');
            // Refresh the institutes table
            loadInstitutes();
        } else {
            showToast(result.detail || 'Failed to update institute', 'error');
        }
    } catch (error) {
        console.error('Error updating institute:', error);
        showToast('Error updating institute', 'error');
    } finally {
        hideLoading();
    }
}

// Export Institutes
async function exportInstitutes() {
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://localhost:8000/api/super-admin/institutes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const institutes = await response.json();
            
            // Convert to CSV
            const headers = ['Institute ID', 'Name', 'Email', 'Phone', 'Type', 'Students', 'Subscription', 'Status', 'Created At'];
            const csvData = institutes.map(inst => [
                inst.institute_id,
                inst.institute_name,
                inst.email,
                inst.phone,
                inst.institute_type,
                inst.student_count,
                inst.subscription_plan,
                inst.is_active ? 'Active' : 'Inactive',
                formatDateTime(inst.created_at)
            ]);
            
            const csv = [headers, ...csvData].map(row => 
                row.map(cell => `"${cell}"`).join(',')
            ).join('\n');
            
            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `institutes_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast('Institutes exported successfully', 'success');
        } else {
            throw new Error('Failed to fetch institutes for export');
        }
    } catch (error) {
        console.error('Error exporting institutes:', error);
        showToast('Error exporting institutes', 'error');
    } finally {
        hideLoading();
    }
}

// Utility Functions for Institutes
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return 'N/A';
    }
}

// Add this to your existing DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    
    // Close modals on escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeModal('viewInstituteModal');
            closeModal('editInstituteModal');
        }
    });
    
    // Close modals when clicking outside
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('fixed')) {
            closeModal('viewInstituteModal');
            closeModal('editInstituteModal');
        }
    });
});

// Load Users
async function loadUsers() {
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://localhost:8000/api/super-admin/users', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            
            // Sort users: SUPER_ADMIN first, then ADMIN, then FACULTY, then STUDENT
            const sortedUsers = users.sort((a, b) => {
                const roleOrder = {
                    'SUPER_ADMIN': 1,
                    'ADMIN': 2,
                    'FACULTY': 3,
                    'STUDENT': 4
                };
                return roleOrder[a.role] - roleOrder[b.role];
            });
            
            renderUsersSection(sortedUsers);
            setTimeout(() => {
                applyDataTablesTheme();
            }, 300);
        }
    } catch (error) {
        showToast('Error loading users: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
//Users Section

function showCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Reset form
        document.getElementById('createUserForm').reset();
        
        // Initialize role change listener
        const roleSelect = document.getElementById('userRole');
        const instituteField = document.getElementById('instituteField');
        
        if (roleSelect && instituteField) {
            // Remove existing event listener first
            roleSelect.removeEventListener('change', handleRoleChange);
            // Add new event listener
            roleSelect.addEventListener('change', handleRoleChange);
            // Trigger change event to set initial state
            roleSelect.dispatchEvent(new Event('change'));
        }
        
        // Set focus to email field
        setTimeout(() => {
            const emailInput = document.getElementById('userEmail');
            if (emailInput) emailInput.focus();
        }, 100);
    } else {
        console.error('Create user modal not found');
        showToast('Error: Create user modal not found', 'error');
    }
}

function handleRoleChange(event) {
    const role = event.target.value;
    const instituteField = document.getElementById('instituteField');
    const instituteInput = document.getElementById('userInstituteId');
    
    if (instituteField && instituteInput) {
        if (role === 'SUPER_ADMIN') {
            instituteField.style.display = 'none';
            instituteInput.required = false;
            instituteInput.value = '';
        } else {
            instituteField.style.display = 'block';
            instituteInput.required = true;
        }
    }
}

function closeCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Create user form submission
async function submitCreateUser(event) {
    event.preventDefault();
    
    // Get form values
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const confirmPassword = document.getElementById('userConfirmPassword').value;
    const role = document.getElementById('userRole').value;
    const instituteId = document.getElementById('userInstituteId').value.trim();
    const isActive = document.getElementById('userIsActive').checked;
    
    // Basic validation
    if (!email || !password || !confirmPassword || !role) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Email validation
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    // Password validation
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    // Password strength validation
    if (!validatePasswordStrength(password)) {
        showToast('Password does not meet strength requirements', 'error');
        return;
    }
    
    // Institute validation for non-super admins
    if (role !== 'SUPER_ADMIN' && !instituteId) {
        showToast('Institute ID is required for this role', 'error');
        return;
    }
    
    // Prepare user data
    const userData = {
        email: email,
        password: password,
        role: role,
        institute_id: role === 'SUPER_ADMIN' ? null : instituteId,
        is_active: isActive
    };
    
    // Send API request
    await createUserAPI(userData);
}

async function createUserAPI(userData) {
    showLoading();
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('http://localhost:8000/users/register', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('User created successfully!', 'success');
            closeCreateUserModal();
            
            // Refresh the users table
            if (document.getElementById('usersSection') && 
                !document.getElementById('usersSection').classList.contains('hidden')) {
                loadUsers();
            }
            
            // Update dashboard stats if on dashboard
            if (document.getElementById('dashboardSection') && 
                !document.getElementById('dashboardSection').classList.contains('hidden')) {
                loadDashboardData();
            }
        } else {
            // Handle specific error messages
            let errorMessage = result.detail || 'Failed to create user';
            
            if (result.detail && typeof result.detail === 'object') {
                errorMessage = Object.values(result.detail).join(', ');
            } else if (Array.isArray(result.detail)) {
                errorMessage = result.detail.map(err => err.msg).join(', ');
            }
            
            showToast(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showToast('Error creating user. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Password validation helper
function validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const specialChars = '!@#$%^&*(),.?":{}|<>';
    const hasSpecial = Array.from(specialChars).some(char => password.includes(char));
    
    return password.length >= minLength && 
           hasUpperCase && 
           hasLowerCase && 
           hasNumbers && 
           hasSpecial;
}

// Email validation helper
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Add password strength indicator to create user form
function initCreateUserForm() {
    const passwordInput = document.getElementById('userPassword');
    const confirmPasswordInput = document.getElementById('userConfirmPassword');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', function(e) {
            updatePasswordStrengthCreate(e.target.value);
        });
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            checkPasswordMatchCreate();
        });
    }
}

function updatePasswordStrengthCreate(password) {
    const strengthBar = document.getElementById('passwordStrengthCreate');
    const strengthText = document.getElementById('passwordStrengthTextCreate');
    
    if (!strengthBar || !strengthText) return;
    
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const specialChars = '!@#$%^&*(),.?":{}|<>';
    const hasSpecial = Array.from(specialChars).some(char => password.includes(char));
    
    let score = 0;
    if (password.length >= minLength) score++;
    if (hasUpperCase) score++;
    if (hasLowerCase) score++;
    if (hasNumbers) score++;
    if (hasSpecial) score++;
    
    let strength = 'Very Weak';
    let color = 'bg-red-500';
    let width = '0%';
    
    if (password.length === 0) {
        strength = 'Enter password';
        color = 'bg-gray-500';
        width = '0%';
    } else if (score <= 2) {
        strength = 'Weak';
        color = 'bg-red-500';
        width = '40%';
    } else if (score === 3) {
        strength = 'Fair';
        color = 'bg-yellow-500';
        width = '60%';
    } else if (score === 4) {
        strength = 'Strong';
        color = 'bg-green-400';
        width = '80%';
    } else if (score === 5) {
        strength = 'Very Strong';
        color = 'bg-green-500';
        width = '100%';
    }
    
    strengthBar.className = `h-1 rounded-full ${color} transition-all duration-300`;
    strengthBar.style.width = width;
    strengthText.textContent = strength;
    strengthText.className = `text-xs ${getStrengthTextColorCreate(score)}`;
}

function getStrengthTextColorCreate(score) {
    if (score <= 2) return 'text-red-400';
    if (score === 3) return 'text-yellow-400';
    if (score === 4) return 'text-green-300';
    if (score === 5) return 'text-green-400';
    return 'text-gray-400';
}

function checkPasswordMatchCreate() {
    const password = document.getElementById('userPassword').value;
    const confirmPassword = document.getElementById('userConfirmPassword').value;
    const matchElement = document.getElementById('passwordMatchCreate');
    const mismatchElement = document.getElementById('passwordMismatchCreate');
    
    if (!password || !confirmPassword) {
        if (matchElement) matchElement.classList.add('hidden');
        if (mismatchElement) mismatchElement.classList.add('hidden');
        return;
    }
    
    if (password === confirmPassword) {
        if (matchElement) {
            matchElement.classList.remove('hidden');
            if (mismatchElement) mismatchElement.classList.add('hidden');
        }
    } else {
        if (mismatchElement) {
            if (matchElement) matchElement.classList.add('hidden');
            mismatchElement.classList.remove('hidden');
        }
    }
}

// Update the users section render to include password visibility toggle for existing users
function addPasswordVisibilityToggle() {
    document.addEventListener('click', function(event) {
        if (event.target.closest('.toggle-password')) {
            const button = event.target.closest('.toggle-password');
            const inputId = button.getAttribute('data-target');
            const input = document.getElementById(inputId);
            
            if (input) {
                const icon = button.querySelector('i');
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    input.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            }
        }
    });
}

// Initialize create user functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initCreateUserForm();
    addPasswordVisibilityToggle();
    
    // Initialize create user modal if it exists
    const modal = document.getElementById('createUserModal');
    if (modal) {
        // Close modal on escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
                closeCreateUserModal();
            }
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeCreateUserModal();
            }
        });
    }
});

function renderUsersSection(users) {
    const section = document.getElementById('usersSection');
    if (!section) return;
    
    // Separate SUPER_ADMIN users for special styling
    const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN');
    const otherUsers = users.filter(u => u.role !== 'SUPER_ADMIN');
    
    section.innerHTML = `
        <div class="mb-6">
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h3 class="text-xl font-semibold">User Management</h3>
                    <p class="text-gray-400">Manage all system users</p>
                </div>
                <div class="flex space-x-3">
                    <div class="relative">
                        <input type="text" placeholder="Search users..." 
                               class="input-dark rounded-lg pl-10 pr-4 py-2 w-64"
                               id="searchUsers">
                        <i class="fas fa-search absolute left-3 top-3 text-gray-500"></i>
                    </div>
                    <button onclick="createUser()" class="px-4 py-2 rounded-lg btn-primary">
                        <i class="fas fa-plus mr-2"></i>Add User
                    </button>
                </div>
            </div>
            
            <div id="createUserModal" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 hidden">
                <div class="glass-card rounded-xl p-6 w-full max-w-md">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-semibold">Add New User</h3>
                        <button onclick="closeCreateUserModal()" class="text-gray-400 hover:text-white">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <form id="createUserForm" onsubmit="submitCreateUser(event)">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-2">Email *</label>
                                <input type="email" id="userEmail" required
                                    class="input-dark w-full rounded-lg px-4 py-2"
                                    placeholder="user@example.com">
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2">Password *</label>
                                <div class="relative">
                                    <input type="password" id="userPassword" required
                                        class="input-dark w-full rounded-lg px-4 py-2 pr-10"
                                        placeholder="••••••••">
                                    <button type="button" class="absolute right-3 top-3 text-gray-500 hover:text-white toggle-password" data-target="userPassword">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                                <div class="mt-2">
                                    <div class="flex justify-between items-center mb-1">
                                        <span class="text-xs text-gray-400">Password strength:</span>
                                        <span class="text-xs" id="passwordStrengthTextCreate">Enter password</span>
                                    </div>
                                    <div class="h-1 bg-gray-700 rounded-full overflow-hidden">
                                        <div id="passwordStrengthCreate" class="h-full rounded-full bg-gray-500 w-0"></div>
                                    </div>
                                </div>
                                <p class="text-xs text-gray-400 mt-2">
                                    Must be at least 8 characters with uppercase, lowercase, number, and special character (!@#$%^&* etc.)
                                </p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2">Confirm Password *</label>
                                <div class="relative">
                                    <input type="password" id="userConfirmPassword" required
                                        class="input-dark w-full rounded-lg px-4 py-2 pr-10"
                                        placeholder="••••••••">
                                    <button type="button" class="absolute right-3 top-3 text-gray-500 hover:text-white toggle-password" data-target="userConfirmPassword">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                                <div class="mt-2 space-y-1">
                                    <div id="passwordMatchCreate" class="hidden">
                                        <p class="text-xs text-green-400">
                                            <i class="fas fa-check mr-1"></i> Passwords match
                                        </p>
                                    </div>
                                    <div id="passwordMismatchCreate" class="hidden">
                                        <p class="text-xs text-red-400">
                                            <i class="fas fa-times mr-1"></i> Passwords do not match
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium mb-2">Role *</label>
                                <select id="userRole" required class="input-dark w-full rounded-lg px-4 py-2">
                                    <option value="">Select Role</option>
                                    <option value="STUDENT">Student</option>
                                    <option value="FACULTY">Faculty</option>
                                    <option value="ADMIN">Institute Admin</option>
                                    <option value="SUPER_ADMIN">Super Admin</option>
                                </select>
                            </div>
                            
                            <div id="instituteField">
                                <label class="block text-sm font-medium mb-2">Institute ID *</label>
                                <input type="text" id="userInstituteId"
                                    class="input-dark w-full rounded-lg px-4 py-2"
                                    placeholder="Enter institute ID">
                                <p class="text-xs text-gray-400 mt-1">
                                    Required for all roles except Super Admin
                                </p>
                            </div>
                            
                            <div class="flex items-center">
                                <input type="checkbox" id="userIsActive" checked
                                    class="mr-2 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900">
                                <label class="text-sm">Active User</label>
                            </div>
                            
                            <div class="flex space-x-3 pt-4">
                                <button type="submit" 
                                        class="flex-1 px-4 py-2 rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                        id="createUserSubmit">
                                    <i class="fas fa-plus mr-2"></i>Create User
                                </button>
                                <button type="button" onclick="closeCreateUserModal()"
                                        class="flex-1 px-4 py-2 rounded-lg btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="glass-card rounded-xl p-4 text-center relative">
                    <p class="text-gray-400">Super Admins</p>
                    <p class="text-2xl font-bold text-indigo-400" id="superAdminCount">${superAdmins.length}</p>
                    ${superAdmins.length > 0 ? `<div class="absolute top-2 right-2">
                        <span class="px-2 py-1 text-xs bg-indigo-900/50 text-indigo-300 rounded-full">Pinned</span>
                    </div>` : ''}
                </div>
                <div class="glass-card rounded-xl p-4 text-center">
                    <p class="text-gray-400">Institute Admins</p>
                    <p class="text-2xl font-bold text-blue-400" id="adminCount">${users.filter(u => u.role === 'ADMIN').length}</p>
                </div>
                <div class="glass-card rounded-xl p-4 text-center">
                    <p class="text-gray-400">Faculty</p>
                    <p class="text-2xl font-bold text-green-400" id="facultyCount">${users.filter(u => u.role === 'FACULTY').length}</p>
                </div>
                <div class="glass-card rounded-xl p-4 text-center">
                    <p class="text-gray-400">Students</p>
                    <p class="text-2xl font-bold text-yellow-400" id="studentCount">${users.filter(u => u.role === 'STUDENT').length}</p>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full" id="usersTable">
                    <thead>
                        <tr class="border-b border-gray-800">
                            <th class="text-left py-3 px-4">ID</th>
                            <th class="text-left py-3 px-4">Email</th>
                            <th class="text-left py-3 px-4">Role</th>
                            <th class="text-left py-3 px-4">Institute</th>
                            <th class="text-left py-3 px-4">Status</th>
                            <!-- REMOVED: Last Active column header -->
                        </tr>
                    </thead>
                    <tbody>
                        <!-- SUPER_ADMIN Users (Pinned) -->
                        ${superAdmins.map(user => `
                            <tr class="border-b border-gray-800 hover:bg-gray-800/50 bg-indigo-900/10">
                                <td class="py-3 px-4 font-mono">
                                    <div class="flex items-center">
                                        <i class="fas fa-thumbtack text-indigo-400 mr-2" title="Pinned: SUPER_ADMIN"></i>
                                        ${user.id}
                                    </div>
                                </td>
                                <td class="py-3 px-4">
                                    <div class="font-medium">${user.email}</div>
                                    <div class="text-sm text-gray-400">Created: ${formatDate(user.created_at)}</div>
                                </td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded text-xs ${getRoleClass(user.role)} flex items-center">
                                        <i class="fas fa-crown mr-1"></i>
                                        ${user.role}
                                    </span>
                                </td>
                                <td class="py-3 px-4">${user.institute_name || 'System'}</td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded text-xs ${user.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}">
                                        ${user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <!-- REMOVED: Last Active column data -->
                            </tr>
                        `).join('')}
                        
                        <!-- Other Users -->
                        ${otherUsers.map(user => `
                            <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                                <td class="py-3 px-4 font-mono">${user.id}</td>
                                <td class="py-3 px-4">
                                    <div class="font-medium">${user.email}</div>
                                    <div class="text-sm text-gray-400">Created: ${formatDate(user.created_at)}</div>
                                </td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded text-xs ${getRoleClass(user.role)}">
                                        ${user.role}
                                    </span>
                                </td>
                                <td class="py-3 px-4">${user.institute_name || 'N/A'}</td>
                                <td class="py-3 px-4">
                                    <span class="px-2 py-1 rounded text-xs ${user.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}">
                                        ${user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <!-- REMOVED: Last Active column data -->
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        if ($.fn.DataTable) {
            // Initialize DataTable
            $('#usersTable').DataTable({
                pageLength: 10,
                lengthMenu: [10, 25, 50, 100],
                order: [], // No initial sorting
                columnDefs: [
                    {
                        // Make SUPER_ADMIN rows always stay at top
                        targets: [2], // Role column (now index 2 since we removed Actions and Last Active columns)
                        render: function(data, type, row) {
                            if (type === 'sort') {
                                // Sort by role order
                                const roleOrder = {
                                    'SUPER_ADMIN': 1,
                                    'ADMIN': 2,
                                    'FACULTY': 3,
                                    'STUDENT': 4
                                };
                                return roleOrder[data] || 5;
                            }
                            return data;
                        }
                    }
                ],
                language: {
                    search: "",
                    searchPlaceholder: "Search users...",
                    lengthMenu: "_MENU_ Entries per page",
                    info: "Showing _START_ to _END_ of _TOTAL_ entries",
                    infoEmpty: "Showing 0 to 0 of 0 entries",
                    infoFiltered: "(filtered from _MAX_ total entries)",
                    paginate: {
                        first: "First",
                        last: "Last",
                        next: "Next",
                        previous: "Previous"
                    }
                },
                dom: '<"flex justify-between items-center mb-4"<"flex items-center"l><"flex items-center"f>>rt<"flex justify-between items-center mt-4"<"dataTables_info"i><"dataTables_paginate"p>>',
                drawCallback: function(settings) {
                    updateDataTablesTheme();
                },
                createdRow: function(row, data, dataIndex) {
                    // Add special class for SUPER_ADMIN rows
                    if (data[2] === 'SUPER_ADMIN') {
                        $(row).addClass('super-admin-row');
                    }
                }
            });
        }
    }, 100);
}
function getRoleClass(role) {
    const classes = {
        'SUPER_ADMIN': 'bg-gradient-to-r from-indigo-900/40 to-purple-900/40 text-indigo-300 border border-indigo-500/30',
        'ADMIN': 'bg-blue-900/30 text-blue-400',
        'FACULTY': 'bg-green-900/30 text-green-400',
        'STUDENT': 'bg-yellow-900/30 text-yellow-400'
    };
    return classes[role] || 'bg-gray-900/30 text-gray-400';
}

// Update charts theme
function updateChartsTheme() {
    const textColor = currentTheme === 'dark' ? '#e2e8f0' : '#334155';
    const gridColor = currentTheme === 'dark' ? '#334155' : '#e2e8f0';
    
    Object.values(charts).forEach(chart => {
        if (chart) {
            if (chart.options.scales) {
                if (chart.options.scales.x) {
                    chart.options.scales.x.grid.color = gridColor;
                    chart.options.scales.x.ticks.color = textColor;
                }
                if (chart.options.scales.y) {
                    chart.options.scales.y.grid.color = gridColor;
                    chart.options.scales.y.ticks.color = textColor;
                }
            }
            if (chart.options.plugins?.legend?.labels) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            chart.update();
        }
    });
}

function updateDataTablesTheme() {
    const isLight = currentTheme === 'light';
    
    document.querySelectorAll('.dataTables_wrapper select, .dataTables_wrapper input[type="search"]').forEach(el => {
        if (isLight) {
            el.classList.remove('dark');
            el.classList.add('light');
        } else {
            el.classList.remove('light');
            el.classList.add('dark');
        }
    });
    
    document.querySelectorAll('.dataTables_wrapper thead th').forEach(th => {
        if (isLight) {
            th.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            th.style.color = '#334155';
        } else {
            th.style.backgroundColor = 'rgba(30, 41, 59, 0.7)';
            th.style.color = '#e2e8f0';
        }
    });
    
    document.querySelectorAll('.dataTables_paginate .paginate_button').forEach(btn => {
        if (isLight) {
            btn.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            btn.style.color = '#334155';
            btn.style.borderColor = 'rgba(99, 102, 241, 0.2)';
        } else {
            btn.style.backgroundColor = 'rgba(30, 41, 59, 0.7)';
            btn.style.color = '#e2e8f0';
            btn.style.borderColor = 'rgba(99, 102, 241, 0.3)';
        }
    });
}

function applyDataTablesTheme() {
    setTimeout(() => {
        updateDataTablesTheme();
        
        document.querySelectorAll('#searchInstitutes, #searchUsers').forEach(input => {
            if (currentTheme === 'light') {
                input.classList.remove('dark');
                input.classList.add('light');
            } else {
                input.classList.remove('light');
                input.classList.add('dark');
            }
        });
    }, 200);
}



// Export Chart
function exportChart(chartId) {
    const chart = charts[chartId];
    if (chart) {
        const link = document.createElement('a');
        link.download = `${chartId}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = chart.toBase64Image();
        link.click();
        showToast('Chart exported successfully!', 'success');
    }
}

// Utility Functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN');
    } catch (e) {
        return 'N/A';
    }
}

function formatTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
    } catch (e) {
        return 'N/A';
    }
}


function createUser() {
    // Show the create user modal
    showCreateUserModal();
}

