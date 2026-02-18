
        
    // ==================== GLOBAL VARIABLES ====================
    let currentUser = null;
    let charts = {};
    let currentTheme = 'dark';
    let authToken = localStorage.getItem('access_token');
    let currentInstituteId = localStorage.getItem('institute_id');
    let currentUserId = localStorage.getItem('user_id');
    let currentUserRole = localStorage.getItem('user_role');
    let currentUserEmail = localStorage.getItem('user_email');
    let currentUserName = localStorage.getItem('admin_name');
    
    // API Configuration
    const API_BASE_URL = 'http://localhost:8000/api/admin';
    const AUTH_BASE_URL = 'http://localhost:8000/auth';
    
    // API Headers
    const getHeaders = () => ({
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
    });
    
   // ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    
    initializeClock();
    
    // Immediately update user display with stored data
    updateUserDisplay();
    
    // Then load fresh data from API
    loadUserProfile();
    
    setActiveTab('dashboard');
    
    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        toggleTheme();
    }
    
    // Event listeners
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    document.getElementById('mobileThemeToggle')?.addEventListener('click', toggleTheme);
    
    // Setup other event listeners
    setupEventListeners();
});
    
    // ==================== AUTHENTICATION ====================
    function checkAuth() {
        if (!authToken || !currentUserRole) {
            window.location.href = '/UI/register.html';
            return false;
        }
        
        // Check if user is admin
        if (!['ADMIN', 'SUPER_ADMIN'].includes(currentUserRole)) {
            showToast('Access denied. Admin privileges required.', 'error');
            setTimeout(() => {
                window.location.href = '/UI/register.html';
            }, 2000);
            return false;
        }
        
        return true;
    }
    
    async function loadUserProfile() {
    try {
        const response = await fetch(`http://localhost:8000/users/profile`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                currentUser = data.data;
                // Store user information
                if (data.data.email) {
                    localStorage.setItem('user_email', data.data.email);
                    currentUserEmail = data.data.email;
                }
                if (data.data.full_name) {
                    localStorage.setItem('admin_name', data.data.full_name);
                    currentUserName = data.data.full_name;
                } else if (data.data.email) {
                    // If no full name, use email username
                    const emailUsername = data.data.email.split('@')[0];
                    const displayName = emailUsername
                        .split(/[._]/)
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    localStorage.setItem('admin_name', displayName);
                    currentUserName = displayName;
                }
                updateUserDisplay();
            } else {
                // If API returns error, use stored data
                useStoredUserData();
            }
        } else {
            // If API fails, use stored data
            useStoredUserData();
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        // Use stored data as fallback
        useStoredUserData();
    }
}

function useStoredUserData() {
    // Use stored data from localStorage
    const storedName = localStorage.getItem('admin_name');
    const storedEmail = localStorage.getItem('user_email');
    
    if (storedName) {
        currentUserName = storedName;
    }
    if (storedEmail) {
        currentUserEmail = storedEmail;
    }
    
    updateUserDisplay();
}
    
    // Replace the updateUserDisplay() function with this corrected version:
function updateUserDisplay() {
    const userName = currentUserName || currentUserEmail?.split('@')[0] || 'Admin';
    const displayName = userName.split(/[._]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    // Update the admin name in the top-right corner
    const adminNameElement = document.getElementById('adminName');
    if (adminNameElement) {
        adminNameElement.textContent = displayName;
    }
    
    // Update the dropdown admin name
    const dropdownAdminName = document.getElementById('dropdownAdminName');
    if (dropdownAdminName) {
        dropdownAdminName.textContent = displayName;
    }
    
    // Update the dropdown admin email
    const dropdownAdminEmail = document.getElementById('dropdownAdminEmail');
    if (dropdownAdminEmail) {
        dropdownAdminEmail.textContent = currentUserEmail || 'Loading...';
    }
    
    // Update the section subtitle
    const sectionSubtitle = document.getElementById('sectionSubtitle');
    if (sectionSubtitle) {
        sectionSubtitle.textContent = `Welcome back, ${displayName}`;
    }
    
    // Also update the profile display name if profile section is loaded
    const profileDisplayName = document.getElementById('profileDisplayName');
    if (profileDisplayName) {
        profileDisplayName.textContent = displayName;
    }
}
    
    // ==================== DASHBOARD FUNCTIONS ====================
    async function loadDashboardData() {
        if (!checkAuth()) return;
        
        showLoading('Loading dashboard data...');
        
        try {
            // Load dashboard stats
            const response = await fetch(`${API_BASE_URL}/dashboard-stats`, {
                headers: getHeaders()
            });
            
            if (response.status === 401) {
                logout();
                return;
            }
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Load faculty data to calculate on leave count
            const facultyResponse = await fetch(`${API_BASE_URL}/faculty`, {
                headers: getHeaders()
            });
            
            if (facultyResponse.ok) {
                const facultyList = await facultyResponse.json();
                // Calculate on leave faculty count
                const onLeaveCount = facultyList.filter(f => f.status === 'ON_LEAVE').length;
                data.on_leave_faculty = onLeaveCount;
            }
            
            updateDashboardUI(data);
            updateSidebarStats(data);
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
            showToast('Error loading dashboard data', 'error');
        } finally {
            hideLoading();
        }
    }
    
    function updateDashboardUI(data) {
        // Safely update elements with null checks
        const elements = {
            'totalStudentsCount': data.total_students?.toLocaleString() || '0',
            'todayAttendanceRate': (data.today_attendance_rate?.toFixed(1) || '0') + '%',
            'activeFacultyCount': data.active_faculty?.toLocaleString() || '0',
            'todayPresentCount': data.today_present || '0',
            'todayTotalCount': data.today_total || '0',
            'weeklyAverageAttendance': calculateWeeklyAverage(data.weekly_trend) + '%'
        };
        
        // Update each element
        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Dashboard element #${id} not found`);
            }
        }
        
        // Update on leave faculty count separately (if it exists in data)
        const onLeaveElement = document.getElementById('onLeaveFacultyCount');
        if (onLeaveElement) {
            onLeaveElement.textContent = data.on_leave_faculty?.toLocaleString() || '0';
        }
        
        // Update chart if it exists
        if (data.weekly_trend && data.weekly_trend.length > 0) {
            updateAttendanceChart(data.weekly_trend);
        }
    }
    function calculateWeeklyAverage(weeklyTrend) {
        if (!weeklyTrend || weeklyTrend.length === 0) return '0';
        
        const totalRate = weeklyTrend.reduce((sum, day) => sum + (day.attendance_rate || 0), 0);
        return (totalRate / weeklyTrend.length).toFixed(1);
    }
    
    function updateSidebarStats(data) {
        // Update sidebar stats
        document.getElementById('sidebarStudentCount').textContent = data.total_students?.toLocaleString() || '0';
        document.getElementById('sidebarActiveFaculty').textContent = data.active_faculty?.toLocaleString() || '0';
        document.getElementById('sidebarTodayPresent').textContent = data.today_present || '0';
        document.getElementById('sidebarTodayAbsent').textContent = data.today_absent || '0';
        
        // Update mobile sidebar
        document.getElementById('mobileStudentCount').textContent = data.total_students?.toLocaleString() || '0';
        document.getElementById('mobileAttendanceBadge').textContent = `Today: ${data.today_attendance_rate?.toFixed(1) || '0'}%`;
        document.getElementById('sidebarAttendanceBadge').textContent = `Today: ${data.today_attendance_rate?.toFixed(1) || '0'}%`;
    }
    
    function updateAttendanceChart(weeklyTrend) {
    const ctx = document.getElementById('attendanceChart')?.getContext('2d');
    if (!ctx || !weeklyTrend || weeklyTrend.length === 0) return;
    
    // Destroy existing chart if it exists
    if (charts.attendance) {
        charts.attendance.destroy();
    }
    
    const labels = weeklyTrend.map(item => item.day_name);
    const values = weeklyTrend.map(item => item.attendance_rate);
    
    // Get theme-specific colors - IMPORTANT: use getComputedStyle to get actual colors
    const isDarkTheme = document.body.classList.contains('dark');
    const textColor = isDarkTheme ? '#e2e8f0' : '#334155';
    const gridColor = isDarkTheme ? '#334155' : '#e2e8f0';
    const tooltipBg = isDarkTheme ? '#1e293b' : '#ffffff';
    
    charts.attendance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attendance %',
                data: values,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: isDarkTheme ? '#0f172a' : '#ffffff',
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
                    backgroundColor: tooltipBg,
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const date = weeklyTrend[index]?.date || '';
                            const present = weeklyTrend[index]?.present || 0;
                            const total = weeklyTrend[index]?.total || 0;
                            return `${context.parsed.y}% (${present}/${total} students)`;
                        }
                    }
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
                    min: 0,
                    max: 100,
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
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

    // ==================== PROFILE MANAGEMENT FUNCTIONS ====================

async function loadProfileData() {
    showLoading('Loading profile...');
    
    try {
        const response = await fetch(`http://localhost:8000/users/profile`, {
            headers: getHeaders()
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

// Helper Functions for Profile
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
        const date = new Date(createdAt);
        createdAtElement.textContent = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

function updateRoleDisplay(role) {
    const roleElements = [
        document.getElementById('profileRole'),
        document.getElementById('profileRoleBadge')
    ];
    
    roleElements.forEach(el => {
        if (el) {
            if (el.id === 'profileRole') {
                el.textContent = role === 'SUPER_ADMIN' ? 'Super Administrator' : 'Institute Administrator';
            } else if (el.id === 'profileRoleBadge') {
                el.textContent = role === 'SUPER_ADMIN' ? 'Super Admin' : 'Institute Admin';
            }
        }
    });
}

async function getFacultyWithClasses(facultyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/faculty`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const facultyList = await response.json();
            const facultyData = facultyList.find(f => f.id === facultyId);
            
            if (facultyData && facultyData.assigned_classes && Array.isArray(facultyData.assigned_classes)) {
                // Extract class names
                facultyData.assigned_classes = facultyData.assigned_classes.map(item => {
                    if (typeof item === 'string') {
                        return item;
                    } else if (item && typeof item === 'object' && item.class_name) {
                        return item.class_name;
                    } else if (item && typeof item === 'object' && item.className) {
                        return item.className;
                    }
                    return String(item);
                }).filter(className => className && className.trim());
            } else {
                facultyData.assigned_classes = [];
            }
            
            return facultyData;
        }
    } catch (error) {
        console.error('Error getting faculty data:', error);
    }
    return null;
}

function populateProfileForm(name, email, createdAt) {
    const profileNameInput = document.getElementById('profileName');
    const profileEmailInput = document.getElementById('profileEmail');
    const profileCreatedAtInput = document.getElementById('profileCreatedAt');
    
    if (profileNameInput) profileNameInput.value = name || '';
    if (profileEmailInput) profileEmailInput.value = email || '';
    if (profileCreatedAtInput) {
        const date = new Date(createdAt);
        profileCreatedAtInput.textContent = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
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

function getStrengthTextColor(score) {
    if (score >= 4) return 'text-green-400';
    if (score >= 3) return 'text-green-300';
    if (score >= 2) return 'text-yellow-400';
    return 'text-red-400';
}

async function exportMyData() {
    showLoading('Exporting your data...');
    
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

function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    
    // Hide all sections
    document.querySelectorAll('[id$="Tab"], [id$="Section"]').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionId === 'profile' ? 'profileSection' : sectionId + 'Tab');
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('fade-in');
    }
    
    // Add active class to clicked nav link
    const navLink = document.querySelector(`[onclick*="showSection('${sectionId}')"]`);
    if (navLink) {
        navLink.classList.add('active');
    }
    
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    const sectionSubtitle = document.getElementById('sectionSubtitle');
    
    const titles = {
        'dashboard': 'Dashboard Overview',
        'faculty': 'Faculty Management',
        'students': 'Student Management',
        'attendance': 'Attendance Management',
        'profile': 'My Profile'
    };
    
    if (pageTitle && titles[sectionId]) {
        pageTitle.textContent = titles[sectionId];
    }
    
    if (sectionSubtitle) {
        if (sectionId === 'dashboard') {
            const userName = localStorage.getItem('admin_name') || 'Admin';
            sectionSubtitle.textContent = `Welcome back, ${userName}`;
        } else {
            const subtitles = {
                'faculty': 'Manage faculty members and their details',
                'students': 'Manage students and their academic records',
                'attendance': 'Track and manage daily attendance records',
                'profile': 'Manage your account information and security'
            };
            sectionSubtitle.textContent = subtitles[sectionId] || '';
        }
    }
    
    // Load data based on section
    if (sectionId === 'profile') {
        initProfileSection();
    } else if (sectionId === 'dashboard') {
        loadDashboardData();
    } else if (sectionId === 'faculty') {
        loadFacultyData();
    } else if (sectionId === 'students') {
        loadStudentsData();
    } else if (sectionId === 'attendance') {
        loadTodaysAttendance();
    }
    
    // Close mobile sidebar if open
    const mobileSidebar = document.getElementById('mobileSidebar');
    if (mobileSidebar && !mobileSidebar.classList.contains('hidden')) {
        toggleSidebar();
    }
}
    
    // ==================== FACULTY MANAGEMENT ====================
    let allFaculty = [];
    let currentFacultyPage = 1;
    const facultyPerPage = 10;
    
    async function loadFacultyData() {
        showLoading('Loading faculty data...');
        
        try {
            const response = await fetch(`${API_BASE_URL}/faculty`, {
                headers: getHeaders()
            });
            
            if (response.ok) {
                allFaculty = await response.json();
                updateFacultyStats(allFaculty);
                renderFacultyTable();
            } else {
                throw new Error('Failed to load faculty data');
            }
        } catch (error) {
            console.error('Error loading faculty:', error);
            showToast('Error loading faculty data', 'error');
        } finally {
            hideLoading();
        }
    }
    
    function updateFacultyStats(facultyList) {
        const total = facultyList.length;
        const active = facultyList.filter(f => f.status === 'ACTIVE' && f.is_active).length;
        const onLeave = facultyList.filter(f => f.status === 'ON_LEAVE').length;
        const inactive = facultyList.filter(f => f.status === 'INACTIVE' || !f.is_active).length;
        
        document.getElementById('facultyTotalCount').textContent = total;
        document.getElementById('facultyActiveCount').textContent = active;
        document.getElementById('facultyLeaveCount').textContent = onLeave;
        document.getElementById('facultyInactiveCount').textContent = inactive;
    }
    
    function renderFacultyTable() {
    const tableBody = document.getElementById('facultyTableBody');
    if (!tableBody) return;
    
    // Remove loading row
    const loadingRow = document.getElementById('facultyLoadingRow');
    if (loadingRow) loadingRow.remove();
    
    // Get filtered faculty
    const filteredFaculty = filterFacultyList(allFaculty);
    const totalPages = Math.ceil(filteredFaculty.length / facultyPerPage);
    const startIndex = (currentFacultyPage - 1) * facultyPerPage;
    const endIndex = startIndex + facultyPerPage;
    const pageFaculty = filteredFaculty.slice(startIndex, endIndex);
    
    tableBody.innerHTML = '';
    
    if (pageFaculty.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-gray-400">
                    <i class="fas fa-users text-3xl mb-3"></i>
                    <p class="text-lg">No faculty members found</p>
                    <p class="text-sm mt-1">Click "Add New Faculty" to add your first faculty member</p>
                </td>
            </tr>
        `;
    } else {
        // Load faculty data with classes
        loadAllFacultyWithClasses().then(facultyWithClasses => {
            pageFaculty.forEach(faculty => {
                // Find the faculty in the processed list
                const processedFaculty = facultyWithClasses.find(f => f.id === faculty.id) || faculty;
                renderFacultyRow(processedFaculty, tableBody);
            });
        }).catch(error => {
            console.error('Error rendering faculty table:', error);
            // Fallback: render without classes
            pageFaculty.forEach(faculty => {
                renderFacultyRow(faculty, tableBody);
            });
        });
    }
    
    // Update table info and pagination
    document.getElementById('facultyTableInfo').textContent = 
        `Showing ${startIndex + 1}-${Math.min(endIndex, filteredFaculty.length)} of ${filteredFaculty.length} faculty members`;
    
    updatePagination('facultyPagination', currentFacultyPage, totalPages, 'changeFacultyPage');
}

async function loadAllFacultyWithClasses() {
    try {
        const response = await fetch(`${API_BASE_URL}/faculty`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const facultyList = await response.json();
            
            // Process the faculty list to ensure assigned_classes are properly formatted
            return facultyList.map(faculty => {
                if (faculty.assigned_classes && Array.isArray(faculty.assigned_classes)) {
                    // Extract class names from objects if needed
                    faculty.assigned_classes = faculty.assigned_classes.map(item => {
                        if (typeof item === 'string') {
                            return item;
                        } else if (item && typeof item === 'object' && item.class_name) {
                            return item.class_name;
                        } else if (item && typeof item === 'object' && item.className) {
                            return item.className;
                        }
                        return String(item);
                    }).filter(className => className && className.trim());
                } else {
                    faculty.assigned_classes = [];
                }
                return faculty;
            });
        }
    } catch (error) {
        console.error('Error loading faculty with classes:', error);
    }
    
    // Fallback: process the existing allFaculty array
    return allFaculty.map(faculty => {
        faculty.assigned_classes = faculty.assigned_classes || [];
        return faculty;
    });
}


function renderFacultyRow(faculty, tableBody) {
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
    
    let statusBadge = '';
    let statusColor = '';
    if (faculty.status === 'ACTIVE' && faculty.is_active) {
        statusBadge = 'Active';
        statusColor = 'badge-success';
    } else if (faculty.status === 'ON_LEAVE') {
        statusBadge = 'On Leave';
        statusColor = 'badge-warning';
    } else {
        statusBadge = 'Inactive';
        statusColor = 'badge-danger';
    }
    
    const lastActive = faculty.last_login 
        ? formatTime(faculty.last_login)
        : 'Never';
    
    // Get assigned classes display - handle different data formats
    let classesDisplay = 'No classes assigned';
    let classesArray = [];
    
    if (faculty.assigned_classes && Array.isArray(faculty.assigned_classes)) {
        classesArray = faculty.assigned_classes.map(item => {
            if (typeof item === 'string') {
                return item;
            } else if (item && typeof item === 'object' && item.class_name) {
                return item.class_name;
            } else if (item && typeof item === 'object' && item.className) {
                return item.className;
            }
            return String(item);
        }).filter(className => className && className.trim());
    }
    
    if (classesArray.length > 0) {
        classesDisplay = classesArray.join(', ');
    }
    
    row.innerHTML = `
        <td class="p-4">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <span class="text-white font-semibold">${getInitials(faculty.full_name)}</span>
                </div>
                <div>
                    <p class="font-medium">${faculty.full_name}</p>
                    <p class="text-sm text-gray-400">${faculty.email}</p>
                </div>
            </div>
        </td>
        <td class="p-4">${faculty.stream || 'N/A'}</td>
        <td class="p-4">
            <span class="badge ${statusColor}">${statusBadge}</span>
        </td>
        <td class="p-4">
            <div class="max-w-xs">
                <p class="text-sm text-gray-400 truncate" title="${classesDisplay}">${classesDisplay}</p>
            </div>
        </td>
        <td class="p-4 text-gray-400 text-sm">${lastActive}</td>
        <td class="p-4">
            <div class="flex space-x-2">
                <button onclick="viewFacultyDetails(${faculty.id})" class="p-2 rounded-lg hover:bg-gray-800" title="View Details">
                    <i class="fas fa-eye text-blue-400"></i>
                </button>
                <button onclick="editFacultyMember(${faculty.id})" class="p-2 rounded-lg hover:bg-gray-800" title="Edit">
                    <i class="fas fa-edit text-yellow-400"></i>
                </button>
                <button onclick="deleteFacultyMember(${faculty.id})" class="p-2 rounded-lg hover:bg-gray-800" title="Delete">
                    <i class="fas fa-trash text-red-400"></i>
                </button>
            </div>
        </td>
    `;
    
    tableBody.appendChild(row);
}
    
    function filterFacultyList(facultyList) {
        const searchTerm = document.getElementById('searchFaculty').value.toLowerCase();
        const statusFilter = document.getElementById('filterFacultyStatus').value;
        
        return facultyList.filter(faculty => {
            const matchesSearch = !searchTerm || 
                faculty.full_name.toLowerCase().includes(searchTerm) ||
                faculty.email.toLowerCase().includes(searchTerm) ||
                (faculty.employee_id && faculty.employee_id.toLowerCase().includes(searchTerm));
            
            const matchesStatus = !statusFilter || 
                faculty.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
    }
    
    function filterFacultyTable() {
        currentFacultyPage = 1;
        renderFacultyTable();
    }
    
    function changeFacultyPage(page) {
        currentFacultyPage = page;
        renderFacultyTable();
    }
    
    // ==================== STUDENT MANAGEMENT ====================
    let allStudents = [];
    let currentStudentPage = 1;
    const studentsPerPage = 10;
    
    async function loadStudentsData() {
        showLoading('Loading student data...');
        
        try {
            const response = await fetch(`${API_BASE_URL}/students`, {
                headers: getHeaders()
            });
            
            if (response.ok) {
                allStudents = await response.json();
                updateStudentStats(allStudents);
                populateClassFilter(allStudents);
                renderStudentsTable();
            } else {
                throw new Error('Failed to load student data');
            }
        } catch (error) {
            console.error('Error loading students:', error);
            showToast('Error loading student data', 'error');
        } finally {
            hideLoading();
        }
    }
    
    function updateStudentStats(students) {
        const total = students.length;
        const active = students.filter(s => s.status === 'ACTIVE' && s.is_active).length;
        const classes = [...new Set(students.map(s => s.class_name).filter(Boolean))].length;
        const streams = [...new Set(students.map(s => s.stream).filter(Boolean))].length;
        
        document.getElementById('studentTotalCount').textContent = total;
        document.getElementById('studentActiveCount').textContent = active;
        document.getElementById('studentClassCount').textContent = classes;
        document.getElementById('studentStreamCount').textContent = streams;
    }
    
    function populateClassFilter(students) {
        const classFilter = document.getElementById('filterStudentClass');
        const classes = [...new Set(students.map(s => s.class_name).filter(Boolean))].sort();
        
        // Clear existing options except "All Classes"
        while (classFilter.options.length > 1) {
            classFilter.remove(1);
        }
        
        // Add class options
        classes.forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            classFilter.appendChild(option);
        });
    }
    
    function renderStudentsTable() {
    const tableBody = document.getElementById('studentsTableBody');
    if (!tableBody) return;
    
    // Remove loading row
    const loadingRow = document.getElementById('studentsLoadingRow');
    if (loadingRow) loadingRow.remove();
    
    // Get filtered students
    const filteredStudents = filterStudentList(allStudents);
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
    const startIndex = (currentStudentPage - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;
    const pageStudents = filteredStudents.slice(startIndex, endIndex);
    
    tableBody.innerHTML = '';
    
    if (pageStudents.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="p-8 text-center text-gray-400">
                    <i class="fas fa-users text-3xl mb-3"></i>
                    <p class="text-lg">No students found</p>
                    <p class="text-sm mt-1">Try adjusting your search or filters</p>
                </td>
            </tr>
        `;
    } else {
        pageStudents.forEach(student => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
            
            let statusBadge = '';
            let statusColor = '';
            if (student.status === 'ACTIVE' && student.is_active) {
                statusBadge = 'Active';
                statusColor = 'badge-success';
            } else if (student.status === 'GRADUATED') {
                statusBadge = 'Graduated';
                statusColor = 'badge-info';
            } else if (student.status === 'SUSPENDED') {
                statusBadge = 'Suspended';
                statusColor = 'badge-danger';
            } else {
                statusBadge = 'Inactive';
                statusColor = 'badge-danger';
            }
            
            const registerDate = student.register_date 
                ? new Date(student.register_date).toLocaleDateString()
                : student.created_at 
                    ? formatDate(new Date(student.created_at))
                    : 'N/A';
            
            row.innerHTML = `
                <td class="p-4 font-mono font-semibold">${student.roll_no}</td>
                <td class="p-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span class="text-white text-sm font-semibold">${getInitials(student.full_name)}</span>
                        </div>
                        <span>${student.full_name}</span>
                    </div>
                </td>
                <td class="p-4">${student.standard || 'N/A'}</td>
                <td class="p-4">${student.stream || 'N/A'}</td>
                <td class="p-4 text-gray-400">${student.email || 'N/A'}</td>
                <td class="p-4 text-gray-400">${student.phone || 'N/A'}</td>
                <td class="p-4">
                    <span class="badge ${statusColor}">${statusBadge}</span>
                </td>
                <td class="p-4 text-gray-400 text-sm">${registerDate}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    // Update table info and pagination
    document.getElementById('studentsTableInfo').textContent = 
        `Showing ${startIndex + 1}-${Math.min(endIndex, filteredStudents.length)} of ${filteredStudents.length} students`;
    
    updatePagination('studentsPagination', currentStudentPage, totalPages, 'changeStudentPage');
}

function filterStudentList(students) {
    const searchTerm = document.getElementById('searchStudents').value.toLowerCase();
    const classFilter = document.getElementById('filterStudentClass').value;
    const statusFilter = document.getElementById('filterStudentStatus').value;
    
    return students.filter(student => {
        const matchesSearch = !searchTerm || 
            student.full_name.toLowerCase().includes(searchTerm) ||
            student.roll_no.toLowerCase().includes(searchTerm) ||
            (student.email && student.email.toLowerCase().includes(searchTerm));
        
        const matchesClass = !classFilter || 
            student.class_name === classFilter;
        
        const matchesStatus = !statusFilter || 
            student.status === statusFilter;
        
        return matchesSearch && matchesClass && matchesStatus;
    });
}

function filterStudentTable() {
    currentStudentPage = 1;
    renderStudentsTable();
}

function changeStudentPage(page) {
    currentStudentPage = page;
    renderStudentsTable();
}

// ==================== ATTENDANCE MANAGEMENT ====================
let attendanceData = [];
let currentAttendanceDate = new Date().toISOString().split('T')[0];

async function loadAttendanceData(date = null) {
    if (!date) {
        date = currentAttendanceDate;
    }
    
    showLoading('Loading attendance data...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/daily?date=${date}`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            attendanceData = await response.json();
            updateAttendanceDisplay(date);
            renderAttendanceTable();
            loadAttendanceStats(date);
        } else {
            throw new Error('Failed to load attendance data');
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        showToast('Error loading attendance data', 'error');
    } finally {
        hideLoading();
    }
}

async function loadAttendanceStats(date) {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/stats?date=${date}`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const stats = await response.json();
            updateAttendanceStats(stats);
        }
    } catch (error) {
        console.error('Error loading attendance stats:', error);
    }
}

function updateAttendanceDisplay(date) {
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput) {
        dateInput.value = date;
    }
    
    const dateDisplay = document.getElementById('attendanceDateDisplay');
    if (dateDisplay) {
        const displayDate = new Date(date);
        const today = new Date().toDateString();
        const isToday = displayDate.toDateString() === today;
        const isYesterday = new Date(Date.now() - 86400000).toDateString() === displayDate.toDateString();
        
        let displayText = formatDate(displayDate);
        if (isToday) {
            displayText += ' (Today)';
        } else if (isYesterday) {
            displayText += ' (Yesterday)';
        }
        
        dateDisplay.textContent = displayText;
    }
}

function updateAttendanceStats(stats) {
    const container = document.getElementById('attendanceStatsContainer');
    if (!container) return;
    
    const attendanceRate = stats.attendance_rate || 0;
    const totalStudents = stats.total_students || 0;
    const presentCount = stats.present_count || 0;
    const absentCount = stats.absent_count || 0;
    const lateCount = stats.late_count || 0;
    const halfDayCount = stats.half_day_count || 0;
    
    container.innerHTML = `
        <div class="glass-card rounded-xl p-4">
            <p class="text-gray-400">Attendance Rate</p>
            <p class="text-2xl font-bold mt-1 ${attendanceRate >= 75 ? 'text-green-400' : attendanceRate >= 50 ? 'text-yellow-400' : 'text-red-400'}">
                ${attendanceRate.toFixed(1)}%
            </p>
        </div>
        <div class="glass-card rounded-xl p-4">
            <p class="text-gray-400">Present</p>
            <p class="text-2xl font-bold text-green-400 mt-1">${presentCount}</p>
        </div>
        <div class="glass-card rounded-xl p-4">
            <p class="text-gray-400">Absent</p>
            <p class="text-2xl font-bold text-red-400 mt-1">${absentCount}</p>
        </div>
        <div class="glass-card rounded-xl p-4">
            <p class="text-gray-400">Total</p>
            <p class="text-2xl font-bold text-blue-400 mt-1">${totalStudents}</p>
        </div>
    `;
}

function renderAttendanceTable() {
    const tableBody = document.getElementById('attendanceTableBody');
    if (!tableBody) return;
    
    // Remove loading row
    const loadingRow = document.getElementById('attendanceLoadingRow');
    if (loadingRow) loadingRow.remove();
    
    tableBody.innerHTML = '';
    
    if (attendanceData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-gray-400">
                    <i class="fas fa-calendar-check text-3xl mb-3"></i>
                    <p class="text-lg">No attendance records for this date</p>
                    <p class="text-sm mt-1">Click "Mark Today's Attendance" to add records</p>
                </td>
            </tr>
        `;
    } else {
        attendanceData.forEach(record => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
            
            let statusBadge = '';
            let statusColor = '';
            if (record.status === 'PRESENT') {
                statusBadge = 'Present';
                statusColor = 'badge-success';
            } else if (record.status === 'ABSENT') {
                statusBadge = 'Absent';
                statusColor = 'badge-danger';
            } else if (record.status === 'LATE') {
                statusBadge = 'Late';
                statusColor = 'badge-warning';
            } else if (record.status === 'HALF_DAY') {
                statusBadge = 'Half Day';
                statusColor = 'badge-info';
            }
            
            const recordedAt = record.created_at 
                ? formatTime(record.created_at)
                : 'N/A';
            
            row.innerHTML = `
                <td class="p-4 font-mono font-semibold">${record.roll_no}</td>
                <td class="p-4">${record.student_name}</td>
                <td class="p-4">${record.class_name || 'N/A'}</td>
                <td class="p-4">
                    ${record.stream || 'N/A'}
                </td>
                <td class="p-4 text-gray-400 text-sm">${recordedAt}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
}

function loadAttendanceForDate() {
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput && dateInput.value) {
        currentAttendanceDate = dateInput.value;
        loadAttendanceData(currentAttendanceDate);
    }
}

function loadTodaysAttendance() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('attendanceDate').value = today;
    currentAttendanceDate = today;
    loadAttendanceData(today);
}

function loadYesterdaysAttendance() {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    document.getElementById('attendanceDate').value = yesterday;
    currentAttendanceDate = yesterday;
    loadAttendanceData(yesterday);
}

// ==================== MODAL FUNCTIONS ====================
function openAddFacultyModal() {
    const modal = document.getElementById('addFacultyModal');
    // Clear any existing class inputs except the first one
    const container = document.getElementById('assignedClassesContainer');
    container.innerHTML = `
        <div class="flex space-x-2">
            <input type="text" class="input-dark w-full rounded-lg px-4 py-3 class-input" 
                   placeholder="e.g., Class 10, Class 12A, etc.">
            <button type="button" onclick="addClassField()" class="btn-primary px-4 py-3 rounded-lg">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `;
    modal.classList.remove('hidden');
}

// Update the closeAddFacultyModal function
function closeAddFacultyModal() {
    const modal = document.getElementById('addFacultyModal');
    modal.classList.add('hidden');
    // Reset the form
    document.getElementById('facultyForm').reset();
    // Clear class inputs
    const container = document.getElementById('assignedClassesContainer');
    container.innerHTML = `
        <div class="flex space-x-2">
            <input type="text" class="input-dark w-full rounded-lg px-4 py-3 class-input" 
                   placeholder="e.g., Class 10, Class 12A, etc.">
            <button type="button" onclick="addClassField()" class="btn-primary px-4 py-3 rounded-lg">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `;
}

function resetFacultyForm() {
    const form = document.getElementById('facultyForm');
    if (form) {
        form.reset();
        document.getElementById('facultyStatus').value = 'ACTIVE';
    }
}

// ==================== CLASS MANAGEMENT FUNCTIONS ====================
function addClassField() {
    const container = document.getElementById('assignedClassesContainer');
    const div = document.createElement('div');
    div.className = 'flex space-x-2';
    div.innerHTML = `
        <input type="text" class="input-dark w-full rounded-lg px-4 py-3 class-input" 
               placeholder="e.g., Class 10, Class 12A, etc.">
        <button type="button" onclick="removeClassField(this)" class="px-4 py-3 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(div);
}

function removeClassField(button) {
    const container = document.getElementById('assignedClassesContainer');
    const inputs = container.querySelectorAll('.class-input');
    if (inputs.length > 1) {
        button.parentElement.remove();
    }
}

function addEditClassField() {
    const container = document.getElementById('editAssignedClassesContainer');
    const div = document.createElement('div');
    div.className = 'flex space-x-2';
    div.innerHTML = `
        <input type="text" class="input-dark w-full rounded-lg px-4 py-3 edit-class-input" 
               placeholder="e.g., Class 10, Class 12A, etc.">
        <button type="button" onclick="removeEditClassField(this)" class="px-4 py-3 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(div);
}

function removeEditClassField(button) {
    const container = document.getElementById('editAssignedClassesContainer');
    const inputs = container.querySelectorAll('.edit-class-input');
    if (inputs.length > 1) {
        button.parentElement.remove();
    }
}

function getAssignedClasses() {
    const inputs = document.querySelectorAll('#assignedClassesContainer .class-input');
    const classes = Array.from(inputs)
        .map(input => input.value.trim())
        .filter(className => className.length > 0);
    return classes;
}

function getEditAssignedClasses() {
    const inputs = document.querySelectorAll('#editAssignedClassesContainer .edit-class-input');
    const classes = Array.from(inputs)
        .map(input => input.value.trim())
        .filter(className => className.length > 0);
    return classes;
}

async function submitFacultyForm() {
    const fullName = document.getElementById('facultyFullName').value.trim();
    const email = document.getElementById('facultyEmail').value.trim();
    const phone = document.getElementById('facultyPhone').value.trim();
    const stream = document.getElementById('facultyStream').value;
    const status = document.getElementById('facultyStatus').value;
    const assignedClasses = getAssignedClasses();
    
    if (!fullName || !email ) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (assignedClasses.length === 0) {
        showToast('At least one class must be assigned to faculty', 'error');
        return;
    }
    
    const facultyData = {
        full_name: fullName,
        email: email,
        phone: phone || null,
        stream: stream || null,
        status: status,
        assigned_classes: assignedClasses
    };
    
    const submitBtn = document.getElementById('submitFacultyBtn');
    const submitText = document.getElementById('facultySubmitText');
    const submitSpinner = document.getElementById('facultySubmitSpinner');
    
    submitBtn.disabled = true;
    submitText.textContent = 'Adding...';
    submitSpinner.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/faculty`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(facultyData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast('Faculty member added successfully!', 'success');
            closeAddFacultyModal();
            loadFacultyData();
            loadDashboardData();
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to add faculty member');
        }
    } catch (error) {
        console.error('Error adding faculty:', error);
        showToast(error.message || 'Error adding faculty member', 'error');
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = 'Add Faculty Member';
        submitSpinner.classList.add('hidden');
    }
}


async function editFacultyMember(facultyId) {
    const faculty = allFaculty.find(f => f.id === facultyId);
    if (!faculty) return;
    
    // Populate edit modal
    document.getElementById('editFacultyId').value = faculty.id;
    document.getElementById('editFacultyFullName').value = faculty.full_name;
    document.getElementById('editFacultyEmail').value = faculty.email;
    document.getElementById('editFacultyPhone').value = faculty.phone || '';
    document.getElementById('editFacultyStream').value = faculty.stream || '';
    document.getElementById('editFacultyStatus').value = faculty.status || 'ACTIVE';
    
    // Clear and populate assigned classes
    const container = document.getElementById('editAssignedClassesContainer');
    container.innerHTML = '';
    
    try {
        // Get faculty details with assigned classes
        const response = await fetch(`${API_BASE_URL}/faculty`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const facultyList = await response.json();
            const currentFaculty = facultyList.find(f => f.id === facultyId);
            
            let classes = [];
            
            if (currentFaculty) {
                if (currentFaculty.assigned_classes && Array.isArray(currentFaculty.assigned_classes)) {
                    // Handle both string array and object array
                    classes = currentFaculty.assigned_classes.map(item => {
                        if (typeof item === 'string') {
                            return item;
                        } else if (item && typeof item === 'object' && item.class_name) {
                            return item.class_name;
                        } else if (item && typeof item === 'object' && item.className) {
                            return item.className;
                        }
                        return '';
                    }).filter(className => className && className.trim());
                }
            }
            
            // If no classes found, add one empty field
            if (classes.length === 0) {
                const div = document.createElement('div');
                div.className = 'flex space-x-2';
                div.innerHTML = `
                    <input type="text" class="input-dark w-full rounded-lg px-4 py-3 edit-class-input" 
                           placeholder="e.g., Class 10, Class 12A, etc.">
                    <button type="button" onclick="removeEditClassField(this)" class="px-4 py-3 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 hidden">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                container.appendChild(div);
            } else {
                // Add class fields for each class
                classes.forEach((className, index) => {
                    const div = document.createElement('div');
                    div.className = 'flex space-x-2';
                    div.innerHTML = `
                        <input type="text" class="input-dark w-full rounded-lg px-4 py-3 edit-class-input" 
                               value="${className}" placeholder="e.g., Class 10, Class 12A, etc.">
                        <button type="button" onclick="removeEditClassField(this)" class="px-4 py-3 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    container.appendChild(div);
                });
            }
        }
    } catch (error) {
        console.error('Error loading assigned classes:', error);
        // Add one empty field as fallback
        const div = document.createElement('div');
        div.className = 'flex space-x-2';
        div.innerHTML = `
            <input type="text" class="input-dark w-full rounded-lg px-4 py-3 edit-class-input" 
                   placeholder="e.g., Class 10, Class 12A, etc.">
            <button type="button" onclick="removeEditClassField(this)" class="px-4 py-3 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 hidden">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(div);
    }
    
    if (faculty.last_login) {
        document.getElementById('editFacultyLastLogin').value = formatDateTime(faculty.last_login);
    } else {
        document.getElementById('editFacultyLastLogin').value = 'Never logged in';
    }
    
    if (faculty.created_at) {
        document.getElementById('editFacultyCreatedAt').value = formatDateTime(faculty.created_at);
    }
    
    const modal = document.getElementById('editFacultyModal');
    modal.classList.remove('hidden');
}


function closeEditFacultyModal() {
    const modal = document.getElementById('editFacultyModal');
    modal.classList.add('hidden');
}

async function submitEditFacultyForm() {
    const facultyId = document.getElementById('editFacultyId').value;
    const fullName = document.getElementById('editFacultyFullName').value.trim();
    const phone = document.getElementById('editFacultyPhone').value.trim();
    const stream = document.getElementById('editFacultyStream').value;
    const status = document.getElementById('editFacultyStatus').value;
    const assignedClasses = getEditAssignedClasses();
    
    if (!facultyId || !fullName ) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (assignedClasses.length === 0) {
        showToast('At least one class must be assigned to faculty', 'error');
        return;
    }
    
    const facultyData = {
        full_name: fullName,
        phone: phone || null,
        stream: stream || null,
        status: status,
        assigned_classes: assignedClasses
    };
    
    const submitBtn = document.getElementById('submitEditFacultyBtn');
    const submitText = document.getElementById('editFacultySubmitText');
    const submitSpinner = document.getElementById('editFacultySubmitSpinner');
    
    submitBtn.disabled = true;
    submitText.textContent = 'Saving...';
    submitSpinner.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/faculty/${facultyId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(facultyData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast('Faculty member updated successfully!', 'success');
            closeEditFacultyModal();
            loadFacultyData();
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update faculty member');
        }
    } catch (error) {
        console.error('Error updating faculty:', error);
        showToast(error.message || 'Error updating faculty member', 'error');
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = 'Save Changes';
        submitSpinner.classList.add('hidden');
    }
}

async function deleteFacultyMember(facultyId) {
    if (!confirm('Are you sure you want to delete this faculty member? This action cannot be undone.')) {
        return;
    }
    
    showLoading('Deleting faculty member...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/faculty/${facultyId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            showToast('Faculty member deleted successfully', 'success');
            loadFacultyData();
            loadDashboardData(); // Refresh dashboard stats
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete faculty member');
        }
    } catch (error) {
        console.error('Error deleting faculty:', error);
        showToast(error.message || 'Error deleting faculty member', 'error');
    } finally {
        hideLoading();
    }
}

async function markTodaysAttendance() {
    const today = new Date().toISOString().split('T')[0];
    
    // Load students for marking attendance
    showLoading('Loading student list...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/students`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const students = await response.json();
            showMarkAttendanceModal(today, students);
        } else {
            throw new Error('Failed to load student list');
        }
    } catch (error) {
        console.error('Error loading students for attendance:', error);
        showToast('Error loading student list', 'error');
    } finally {
        hideLoading();
    }
}

function showMarkAttendanceModal(date, students) {
    const modal = document.getElementById('markAttendanceModal');
    const title = document.getElementById('markAttendanceTitle');
    const dateDisplay = document.getElementById('markAttendanceDate');
    const tableBody = document.getElementById('markAttendanceTableBody');
    
    const displayDate = new Date(date);
    const isToday = displayDate.toDateString() === new Date().toDateString();
    
    title.textContent = isToday ? "Mark Today's Attendance" : `Mark Attendance for ${formatDate(displayDate)}`;
    dateDisplay.textContent = `Date: ${formatDate(displayDate)}`;
    
    // Load existing attendance for this date if any
    loadExistingAttendance(date, students, tableBody);
    
    modal.classList.remove('hidden');
}

async function loadExistingAttendance(date, students, tableBody) {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/daily?date=${date}`, {
            headers: getHeaders()
        });
        
        const existingAttendance = response.ok ? await response.json() : [];
        
        renderMarkAttendanceTable(students, existingAttendance, tableBody);
    } catch (error) {
        console.error('Error loading existing attendance:', error);
        renderMarkAttendanceTable(students, [], tableBody);
    }
}

function renderMarkAttendanceTable(students, existingAttendance, tableBody) {
    tableBody.innerHTML = '';
    
    students.forEach((student, index) => {
        const existingRecord = existingAttendance.find(a => a.student_id === student.student_id);
        const currentStatus = existingRecord ? existingRecord.status : 'PRESENT';
        
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
        row.innerHTML = `
            <td class="p-4 font-mono">${student.roll_no}</td>
            <td class="p-4">${student.full_name}</td>
            <td class="p-4">${student.class_name || 'N/A'}</td>
            <td class="p-4">${student.stream || 'N/A'}</td>
            <td class="p-4">
                <select class="input-dark rounded-lg px-3 py-2 text-sm w-full attendance-status" 
                        data-student-id="${student.student_id}" 
                        onchange="updateAttendanceStatus(${student.student_id}, this.value)">
                    <option value="PRESENT" ${currentStatus === 'PRESENT' ? 'selected' : ''}>Present</option>
                    <option value="ABSENT" ${currentStatus === 'ABSENT' ? 'selected' : ''}>Absent</option>
                    <option value="LATE" ${currentStatus === 'LATE' ? 'selected' : ''}>Late</option>
                    <option value="HALF_DAY" ${currentStatus === 'HALF_DAY' ? 'selected' : ''}>Half Day</option>
                </select>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function markAllPresent() {
    const statusSelects = document.querySelectorAll('.attendance-status');
    statusSelects.forEach(select => {
        select.value = 'PRESENT';
        const studentId = select.getAttribute('data-student-id');
        updateAttendanceStatus(studentId, 'PRESENT');
    });
}

function markAllAbsent() {
    const statusSelects = document.querySelectorAll('.attendance-status');
    statusSelects.forEach(select => {
        select.value = 'ABSENT';
        const studentId = select.getAttribute('data-student-id');
        updateAttendanceStatus(studentId, 'ABSENT');
    });
}

let attendanceMarkingData = {};

function updateAttendanceStatus(studentId, status) {
    attendanceMarkingData[studentId] = status;
}

function closeMarkAttendanceModal() {
    const modal = document.getElementById('markAttendanceModal');
    modal.classList.add('hidden');
    attendanceMarkingData = {};
}

async function submitAttendance() {
    const dateInput = document.getElementById('attendanceDate');
    const date = dateInput.value || new Date().toISOString().split('T')[0];
    
    const attendanceRecords = Object.entries(attendanceMarkingData).map(([studentId, status]) => ({
        student_id: parseInt(studentId),
        status: status
    }));
    
    if (attendanceRecords.length === 0) {
        showToast('No attendance data to save', 'warning');
        return;
    }
    
    const attendanceData = {
        date: date,
        attendance_records: attendanceRecords
    };
    
    const submitBtn = document.getElementById('submitAttendanceBtn');
    const submitText = document.getElementById('submitAttendanceText');
    const submitSpinner = document.getElementById('submitAttendanceSpinner');
    
    submitBtn.disabled = true;
    submitText.textContent = 'Saving...';
    submitSpinner.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/mark`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(attendanceData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast(`Attendance saved successfully! ${result.success_count} records updated`, 'success');
            closeMarkAttendanceModal();
            loadAttendanceData(date);
            loadDashboardData(); // Refresh dashboard stats
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save attendance');
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        showToast(error.message || 'Error saving attendance', 'error');
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = 'Save Attendance';
        submitSpinner.classList.add('hidden');
    }
}

// ==================== EXPORT FUNCTIONS ====================
async function exportReport(reportType) {
    const exportData = {
        report_type: reportType,
        format: 'excel',
        start_date: null,
        end_date: null,
        batch: null
    };
    
    showLoading(`Generating ${reportType} report...`);
    
    try {
        const response = await fetch(`${API_BASE_URL}/export`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(exportData)
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast(`${reportType} report downloaded successfully!`, 'success');
        } else {
            throw new Error('Failed to generate report');
        }
    } catch (error) {
        console.error('Error exporting report:', error);
        showToast('Error exporting report', 'error');
    } finally {
        hideLoading();
    }
}

// ==================== UTILITY FUNCTIONS ====================
function getInitials(name) {
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(dateTime) {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatDateTime(dateTime) {
    const date = new Date(dateTime);
    return `${formatDate(date)} ${formatTime(date)}`;
}

function updatePagination(elementId, currentPage, totalPages, callbackFunction) {
    const paginationContainer = document.getElementById(elementId);
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    if (currentPage > 1) {
        html += `<button onclick="${callbackFunction}(${currentPage - 1})" class="px-3 py-1 rounded-lg glass-card hover:bg-gray-800/50">
                    <i class="fas fa-chevron-left"></i>
                </button>`;
    }
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="px-3 py-1 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                        ${i}
                    </button>`;
        } else {
            html += `<button onclick="${callbackFunction}(${i})" class="px-3 py-1 rounded-lg glass-card hover:bg-gray-800/50">
                        ${i}
                    </button>`;
        }
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `<button onclick="${callbackFunction}(${currentPage + 1})" class="px-3 py-1 rounded-lg glass-card hover:bg-gray-800/50">
                    <i class="fas fa-chevron-right"></i>
                </button>`;
    }
    
    paginationContainer.innerHTML = html;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');
    
    let icon = 'fa-info-circle';
    let iconColor = 'text-blue-400';
    
    if (type === 'success') {
        icon = 'fa-check-circle';
        iconColor = 'text-green-400';
    } else if (type === 'error') {
        icon = 'fa-exclamation-circle';
        iconColor = 'text-red-400';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-triangle';
        iconColor = 'text-yellow-400';
    }
    
    toastIcon.className = `fas ${icon} ${iconColor}`;
    toastMessage.textContent = message;
    
    toast.classList.remove('hidden');
    toast.classList.add('success-toast');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function showLoading(text = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    loadingText.textContent = text;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
}

// ==================== THEME MANAGEMENT ====================
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    const mobileThemeIcon = document.getElementById('mobileThemeToggle')?.querySelector('i');
    
    if (body.classList.contains('dark')) {
        body.classList.remove('dark');
        body.classList.add('light');
        currentTheme = 'light';
        if (themeIcon) themeIcon.className = 'fas fa-sun';
        if (mobileThemeIcon) mobileThemeIcon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light');
        body.classList.add('dark');
        currentTheme = 'dark';
        if (themeIcon) themeIcon.className = 'fas fa-moon';
        if (mobileThemeIcon) mobileThemeIcon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'dark');
    }
    
    // Refresh the chart with new theme colors
    if (charts.attendance) {
        // Get the weekly trend data from the existing chart
        const chartData = charts.attendance.data;
        const weeklyTrend = chartData.labels.map((label, index) => ({
            day_name: label,
            attendance_rate: chartData.datasets[0].data[index]
        }));
        
        // Destroy and recreate the chart with new theme
        updateAttendanceChart(weeklyTrend);
    }
}

// ==================== NAVIGATION & UI ====================
function setActiveTab(tabName) {
    // Hide all tabs
    document.getElementById('dashboardTab').classList.add('hidden');
    document.getElementById('facultyTab').classList.add('hidden');
    document.getElementById('studentsTab').classList.add('hidden');
    document.getElementById('attendanceTab').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}Tab`).classList.remove('hidden');
    if (tabName === 'profile') {
        document.getElementById('profileSection').classList.remove('hidden');
    }
    
    // Add active class to clicked nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.textContent.includes(tabName.charAt(0).toUpperCase() + tabName.slice(1))) {
            link.classList.add('active');
        }
    });
    
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    const sectionSubtitle = document.getElementById('sectionSubtitle');
    
    switch(tabName) {
        case 'dashboard':
            pageTitle.textContent = 'Dashboard Overview';
            sectionSubtitle.textContent = `Welcome back, ${currentUserName || 'Admin'}`;
            loadDashboardData();
            break;
        case 'faculty':
            pageTitle.textContent = 'Faculty Management';
            sectionSubtitle.textContent = 'Manage faculty members and their details';
            loadFacultyData();
            break;
        case 'students':
            pageTitle.textContent = 'Student Management';
            sectionSubtitle.textContent = 'Manage students and their academic records';
            loadStudentsData();
            break;
        case 'attendance':
            pageTitle.textContent = 'Attendance Management';
            sectionSubtitle.textContent = 'Track and manage daily attendance records';
            loadTodaysAttendance();
            break;
        case 'profile':
            pageTitle.textContent = 'My Profile';
            sectionSubtitle.textContent = 'Manage your account information and security';
            initProfileSection();
            break;
    }
    
    // Close mobile sidebar if open
    const mobileSidebar = document.getElementById('mobileSidebar');
    if (mobileSidebar && !mobileSidebar.classList.contains('hidden')) {
        toggleSidebar();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('mobileSidebar');
    sidebar.classList.toggle('hidden');
}

function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('hidden');
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.add('hidden');
    });
}

// ==================== TIME FUNCTIONS ====================
function initializeClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    
    // Update current time
    const currentTimeElement = document.getElementById('currentTime');
    if (currentTimeElement) {
        currentTimeElement.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
    
    // Update current date
    const currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
        currentDateElement.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        const userDropdown = document.getElementById('userDropdown');
        const dropdownToggle = document.querySelector('[onclick="toggleUserDropdown()"]');
        
        if (userDropdown && !userDropdown.contains(event.target) && !dropdownToggle.contains(event.target)) {
            userDropdown.classList.add('hidden');
        }
    });
    
    // Close modals when clicking outside
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal-overlay')) {
            closeAllModals();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Refresh dashboard with F5
        if (event.key === 'F5') {
            event.preventDefault();
            refreshDashboard();
        }
        
        // Escape key closes modals
        if (event.key === 'Escape') {
            closeAllModals();
            const userDropdown = document.getElementById('userDropdown');
            if (userDropdown && !userDropdown.classList.contains('hidden')) {
                userDropdown.classList.add('hidden');
            }
        }
    });
}

function refreshDashboard() {
    if (document.getElementById('dashboardTab').classList.contains('hidden')) {
        setActiveTab('dashboard');
    } else {
        loadDashboardData();
        showToast('Dashboard refreshed', 'info');
    }
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

// ==================== LOGOUT ====================
async function logout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }
    
    showLoading('Logging out...');
    
    try {
        const response = await fetch(`http://localhost:8000/auth/logout`, {
            method: 'POST',
            headers: getHeaders()
        });
        
        // Clear local storage
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_role');
        localStorage.removeItem('institute_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('admin_name');
        
        // Redirect to login page
        setTimeout(() => {
            window.location.href = '/UI/register.html';
        }, 1000);
        
    } catch (error) {
        console.error('Error logging out:', error);
        // Still redirect even if logout API fails
        localStorage.clear();
        window.location.href = '/UI/register.html';
    }
}

// ==================== HELPER FUNCTIONS ====================
function viewFacultyDetails(facultyId) {
    const faculty = allFaculty.find(f => f.id === facultyId);
    if (!faculty) return;
    
    // Create a modal to show detailed information
    const detailsHtml = `
        <div class="p-6">
            <h3 class="text-xl font-bold neuroface-gradient mb-4">Faculty Details</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-gray-800/30 rounded-lg p-4">
                    <h4 class="text-sm text-gray-400 mb-1">Personal Information</h4>
                    <p class="font-medium">${faculty.full_name}</p>
                    <p class="text-sm text-gray-400">${faculty.email}</p>
                    <p class="text-sm text-gray-400 mt-1">${faculty.phone || 'Phone: N/A'}</p>
                </div>
                
                <div class="bg-gray-800/30 rounded-lg p-4">
                    <h4 class="text-sm text-gray-400 mb-1">Professional Information</h4>
                    <p class="text-sm text-gray-400">Stream: ${faculty.stream || 'N/A'}</p>
                    <p class="text-sm text-gray-400 mt-1">
                        Status: <span class="${faculty.status === 'ACTIVE' ? 'text-green-400' : faculty.status === 'ON_LEAVE' ? 'text-yellow-400' : 'text-red-400'}">${faculty.status}</span>
                    </p>
                </div>
                
                <div class="bg-gray-800/30 rounded-lg p-4 md:col-span-2">
                    <h4 class="text-sm text-gray-400 mb-2">Activity Information</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                            <p class="text-sm text-gray-400">Last Login:</p>
                            <p class="font-medium">${faculty.last_login ? formatDateTime(faculty.last_login) : 'Never'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-400">Account Created:</p>
                            <p class="font-medium">${faculty.created_at ? formatDateTime(faculty.created_at) : 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Assigned Classes Section -->
            <div class="mt-6">
                <h4 class="text-sm font-medium mb-2">Assigned Classes</h4>
                <div id="assignedClassesList" class="flex flex-wrap gap-2">
                    <!-- Classes will be loaded here via AJAX -->
                    <div class="loading-spinner mx-auto my-4"></div>
                </div>
            </div>
            
            <div class="mt-6 pt-6 border-t border-gray-800">
                <button onclick="closeFacultyDetails()" class="w-full px-4 py-2 rounded-lg glass-card hover:bg-gray-800/50">
                    Close
                </button>
            </div>
        </div>
    `;
    
    // Create and show modal
    const modal = document.createElement('div');
    modal.id = 'facultyDetailsModal';
    modal.className = 'fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="modal-content rounded-xl w-full max-w-2xl">
            ${detailsHtml}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load assigned classes
    loadAssignedClassesForFaculty(facultyId);
}

async function loadAssignedClassesForFaculty(facultyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/faculty`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const facultyList = await response.json();
            const facultyData = facultyList.find(f => f.id === facultyId);
            const container = document.getElementById('assignedClassesList');
            
            if (container) {
                if (facultyData && facultyData.assigned_classes && Array.isArray(facultyData.assigned_classes)) {
                    // Extract class names from objects if needed
                    const classes = facultyData.assigned_classes.map(item => {
                        if (typeof item === 'string') {
                            return item;
                        } else if (item && typeof item === 'object' && item.class_name) {
                            return item.class_name;
                        } else if (item && typeof item === 'object' && item.className) {
                            return item.className;
                        }
                        return String(item);
                    }).filter(className => className && className.trim());
                    
                    if (classes.length > 0) {
                        container.innerHTML = classes.map(className => `
                            <span class="px-3 py-1 rounded-full bg-indigo-900/30 text-indigo-400 text-sm">
                                ${className}
                            </span>
                        `).join('');
                    } else {
                        container.innerHTML = '<p class="text-gray-400">No classes assigned</p>';
                    }
                } else {
                    container.innerHTML = '<p class="text-gray-400">No classes assigned</p>';
                }
            }
        }
    } catch (error) {
        console.error('Error loading assigned classes:', error);
        const container = document.getElementById('assignedClassesList');
        if (container) {
            container.innerHTML = '<p class="text-red-400">Error loading classes</p>';
        }
    }
}

function closeFacultyDetails() {
    const modal = document.getElementById('facultyDetailsModal');
    if (modal) {
        modal.remove();
    }
}

function editAttendanceRecord(attendanceId) {
    const record = attendanceData.find(a => a.id === attendanceId);
    if (!record) return;
    
    // Show a modal or prompt to edit attendance
    const newStatus = prompt(`Edit attendance for ${record.student_name}\nCurrent status: ${record.status}\n\nEnter new status (PRESENT, ABSENT, LATE, HALF_DAY):`, record.status);
    
    if (newStatus && ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'].includes(newStatus.toUpperCase())) {
        updateSingleAttendance(attendanceId, newStatus.toUpperCase());
    } else if (newStatus !== null) {
        showToast('Invalid status entered', 'error');
    }
}

async function updateSingleAttendance(attendanceId, newStatus) {
    showLoading('Updating attendance...');
    
    try {
        // First get the attendance record
        const response = await fetch(`${API_BASE_URL}/attendance/${attendanceId}`, {
            headers: getHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch attendance record');
        }
        
        const record = await response.json();
        
        // Update the record
        const updateResponse = await fetch(`${API_BASE_URL}/attendance/${attendanceId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
                status: newStatus,
                recorded_by: currentUserId
            })
        });
        
        if (updateResponse.ok) {
            showToast('Attendance updated successfully', 'success');
            loadAttendanceData(record.attendance_date);
        } else {
            throw new Error('Failed to update attendance');
        }
    } catch (error) {
        console.error('Error updating attendance:', error);
        showToast('Error updating attendance', 'error');
    } finally {
        hideLoading();
    }
}

// Load classes and streams for filters
async function loadClasses() {
    try {
        const response = await fetch(`${API_BASE_URL}/classes`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const classes = await response.json();
            updateClassFilter(classes);
        }
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

async function loadStreams() {
    try {
        const response = await fetch(`${API_BASE_URL}/streams`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const streams = await response.json();
            updateStreamFilter(streams);
        }
    } catch (error) {
        console.error('Error loading streams:', error);
    }
}

function updateClassFilter(classes) {
    const filterElement = document.getElementById('filterStudentClass');
    if (!filterElement) return;
    
    // Clear existing options except "All Classes"
    while (filterElement.options.length > 1) {
        filterElement.remove(1);
    }
    
    // Add class options
    classes.forEach(standard => {
        const option = document.createElement('option');
        option.value = standard;
        option.textContent = standard;
        filterElement.appendChild(option);
    });
}

function updateStreamFilter(streams) {
    // If you have a stream filter element, update it here
    // Similar to updateClassFilter
}

// Initialize everything when page loads
window.onload = function() {
    if (checkAuth()) {
        setActiveTab('dashboard');
        // Load initial data
        Promise.all([
            loadDashboardData(),
            loadFacultyData(),
            loadStudentsData(),
            loadClasses(),
            loadStreams()
        ]).catch(error => {
            console.error('Error loading initial data:', error);
        });
    }
};

// Export utility functions globally for HTML onclick handlers
window.setActiveTab = setActiveTab;
window.toggleSidebar = toggleSidebar;
window.toggleUserDropdown = toggleUserDropdown;
window.toggleTheme = toggleTheme;
window.openAddFacultyModal = openAddFacultyModal;
window.closeAddFacultyModal = closeAddFacultyModal;
window.editFacultyMember = editFacultyMember;
window.deleteFacultyMember = deleteFacultyMember;
window.viewFacultyDetails = viewFacultyDetails;
window.markTodaysAttendance = markTodaysAttendance;
window.loadTodaysAttendance = loadTodaysAttendance;
window.loadYesterdaysAttendance = loadYesterdaysAttendance;
window.loadAttendanceForDate = loadAttendanceForDate;
window.exportReport = exportReport;
window.refreshDashboard = refreshDashboard;
window.logout = logout;
window.filterFacultyTable = filterFacultyTable;
window.filterStudentTable = filterStudentTable;
window.markAllPresent = markAllPresent;
window.markAllAbsent = markAllAbsent;
window.submitAttendance = submitAttendance;
window.closeMarkAttendanceModal = closeMarkAttendanceModal;
