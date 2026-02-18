
    // ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let charts = {};
let currentTheme = 'dark';
let authToken = localStorage.getItem('access_token');
let currentUserId = localStorage.getItem('user_id');
let currentUserRole = localStorage.getItem('user_role');
let currentUserEmail = localStorage.getItem('user_email');
let currentUserName = localStorage.getItem('student_name');

// Calendar variables
let currentCalendarDate = new Date();

// Attendance records
let allAttendanceRecords = [];
let currentRecordsPage = 1;
const recordsPerPage = 10;

// Leave requests
let leaveRequests = [];

// API Configuration
const API_BASE_URL = 'http://localhost:8000/api/student';
const AUTH_BASE_URL = 'http://localhost:8000/auth';

// API Headers
const getHeaders = () => ({
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
});

// ==================== TOKEN EXPIRATION HANDLING ====================
function checkTokenExpired(response) {
    if (response.status === 401) {
        // Token expired or invalid
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => {
            logout();
        }, 2000);
        return true;
    }
    return false;
}

// ==================== AUTHENTICATION ====================
function checkAuth() {
    if (!authToken || !currentUserRole) {
        window.location.href = '/UI/register.html';
        return false;
    }
    
    // Check if user is student
    if (currentUserRole !== 'STUDENT') {
        showToast('Access denied. Student privileges required.', 'error');
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
        
        if (checkTokenExpired(response)) {
            return;
        }
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                currentUser = data.data;
                
                // Store user information
                if (data.data.email) {
                    localStorage.setItem('user_email', data.data.email);
                    currentUserEmail = data.data.email;
                }
                
                // Use full_name from student data if available
                if (data.data.full_name) {
                    localStorage.setItem('student_name', data.data.full_name);
                    currentUserName = data.data.full_name;
                } else if (data.data.email) {
                    // If no full name, use email username
                    const emailUsername = data.data.email.split('@')[0];
                    const displayName = emailUsername
                        .split(/[._]/)
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    localStorage.setItem('student_name', displayName);
                    currentUserName = displayName;
                }
                
                // Store academic info
                if (data.data.roll_no) {
                    localStorage.setItem('student_roll_no', data.data.roll_no);
                }
                if (data.data.class) {
                    localStorage.setItem('student_class', data.data.class);
                }
                if (data.data.stream) {
                    localStorage.setItem('student_stream', data.data.stream);
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
    const storedName = localStorage.getItem('student_name');
    const storedEmail = localStorage.getItem('user_email');
    
    if (storedName) {
        currentUserName = storedName;
    }
    if (storedEmail) {
        currentUserEmail = storedEmail;
    }
    
    updateUserDisplay();
}

function updateUserDisplay() {
    const userName = currentUserName || currentUserEmail?.split('@')[0] || 'Student';
    const displayName = userName.split(/[._]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    // Update the student name in the top-right corner
    const studentNameElement = document.getElementById('studentName');
    if (studentNameElement) {
        studentNameElement.textContent = displayName;
    }
    
    // Update the dropdown student name
    const dropdownStudentName = document.getElementById('dropdownStudentName');
    if (dropdownStudentName) {
        dropdownStudentName.textContent = displayName;
    }
    
    // Update the dropdown student email
    const dropdownStudentEmail = document.getElementById('dropdownStudentEmail');
    if (dropdownStudentEmail) {
        dropdownStudentEmail.textContent = currentUserEmail || 'Loading...';
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
    
    // Update student class info with stored academic data
    const studentClassElement = document.getElementById('studentClass');
    if (studentClassElement) {
        const storedClass = localStorage.getItem('student_class');
        const storedStream = localStorage.getItem('student_stream');
        
        if (storedClass && storedStream) {
            studentClassElement.textContent = `Class: ${storedClass} - ${storedStream}`;
        } else if (storedClass) {
            studentClassElement.textContent = `Class: ${storedClass}`;
        } else {
            // Fallback
            studentClassElement.textContent = 'Class: Grade 10 - Science';
        }
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    
    initializeClock();
    
    // Reset calendar to current date
    currentCalendarDate = new Date();
    
    // Initialize recent attendance with loading state immediately
    initializeRecentAttendance();
    
    // Load user profile first, then dashboard
    loadUserProfile().then(() => {
        // Update user display with stored data
        updateUserDisplay();
        
        // Initialize filters
        populateMonthFilter();
        populateYearFilter();
        
        // Then load dashboard data
        loadDashboardData();
        
        // Load other components
        loadAttendanceTrendChart();
        generateCalendar(); // This will now show correct month
        
        // Set active tab
        setActiveTab('dashboard');
    }).catch(error => {
        console.error('Error loading profile:', error);
        updateUserDisplay();
        populateMonthFilter();
        populateYearFilter();
        loadDashboardData();
        // Reset calendar date
        currentCalendarDate = new Date();
        generateCalendar();
        setActiveTab('dashboard');
    });
    
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

// ==================== DASHBOARD FUNCTIONS ====================
async function loadDashboardData() {
    if (!checkAuth()) return;
    
    showLoading('Loading dashboard data...');
    
    // Initialize with loading state first
    initializeRecentAttendance();
    
    try {
        // Call dashboard stats API
        const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            hideLoading();
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            updateDashboardUI(result.data);
            updateSidebarStats(result.data);
            updateUserInfo(result.data.student_info);
            
            // Store data for offline use
            localStorage.setItem('dashboard_data', JSON.stringify(result.data));
            localStorage.setItem('last_dashboard_update', new Date().toISOString());
            
            // Check if recent attendance was loaded, if not load it separately
            if (!result.data.recent_attendance || result.data.recent_attendance.length === 0) {
                await loadRecentAttendanceDirectly();
            }
            
        } else {
            throw new Error(result.message || 'Failed to load dashboard data');
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard data. Please try again.', 'error');
        
        // Try to load recent attendance separately if main API fails
        await loadRecentAttendanceDirectly();
    } finally {
        hideLoading();
    }
}

// Add this new function to load recent attendance directly
async function loadRecentAttendanceDirectly() {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/records?limit=4`, {
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            return;
        }
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.records) {
                updateRecentAttendance(result.data.records);
                return;
            }
        }
        
        // If API call fails or returns no data, show fallback
        showFallbackRecentAttendance();
        
    } catch (error) {
        console.error('Error loading recent attendance directly:', error);
        showFallbackRecentAttendance();
    }
}

async function loadRecentAttendanceFallback() {
    try {
        // Try to load recent attendance directly from API
        const response = await fetch(`${API_BASE_URL}/attendance/records?limit=4`, {
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            return;
        }
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.records) {
                updateRecentAttendance(result.data.records);
                return;
            }
        }
        
        // If API fails, show fallback message
        showFallbackRecentAttendance();
        
    } catch (error) {
        console.error('Error loading recent attendance:', error);
        showFallbackRecentAttendance();
    }
}

function showFallbackRecentAttendance() {
    const recentContainer = document.getElementById('recentAttendanceContainer');
    const loadingElement = document.getElementById('recentAttendanceLoading');
    
    if (!recentContainer) return;
    
    // Hide loading
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    // Show fallback message
    recentContainer.innerHTML = `
        <div class="p-8 text-center text-gray-400">
            <i class="fas fa-calendar-alt text-3xl mb-3"></i>
            <p class="text-lg">No recent attendance data</p>
            <p class="text-sm mt-1">Could not load attendance records</p>
            <button onclick="loadDashboardData()" class="mt-3 px-4 py-2 text-sm bg-indigo-900/30 text-indigo-400 rounded-lg hover:bg-indigo-900/50">
                <i class="fas fa-sync-alt mr-2"></i>Try Again
            </button>
        </div>
    `;
}

async function refreshRecentAttendance() {
    const recentContainer = document.getElementById('recentAttendanceContainer');
    if (!recentContainer) return;
    
    // Show loading
    recentContainer.innerHTML = `
        <div class="p-8 text-center text-gray-400">
            <div class="flex items-center justify-center space-x-2">
                <div class="loading-spinner"></div>
                <span>Refreshing...</span>
            </div>
        </div>
    `;
    
    try {
        await loadRecentAttendanceDirectly();
        showToast('Recent attendance refreshed', 'success');
    } catch (error) {
        console.error('Error refreshing recent attendance:', error);
        showFallbackRecentAttendance();
        showToast('Error refreshing attendance', 'error');
    }
}

function updateDashboardUI(data) {
    if (!data) return;
    
    // Safely update all elements with null checks
    try {
        // Update overall attendance
        const overallPercent = data.monthly_stats?.attendance_percent || 0;
        const overallElement = document.getElementById('overallAttendancePercent');
        if (overallElement) {
            overallElement.textContent = overallPercent.toFixed(1) + '%';
        }
        
        // Update monthly stats
        const monthStats = data.monthly_stats || {};
        const presentDays = monthStats.present_days || 0;
        const workingDays = monthStats.working_days || 0;
        const absentDays = monthStats.absent_days || 0;
        
        const presentElement = document.getElementById('monthPresentDays');
        if (presentElement) presentElement.textContent = presentDays;
        
        const workingElement = document.getElementById('monthWorkingDays');
        if (workingElement) workingElement.textContent = workingDays;
        
        const absentElement = document.getElementById('monthAbsentDays');
        if (absentElement) absentElement.textContent = absentDays;
        
        document.getElementById('monthLeavesUsed').textContent = monthStats.leaves_used || 0;
        
        // Update attendance status text
        updateAttendanceStatusText(overallPercent);
        
        // Update progress bars if they exist
        updateProgressBars(presentDays, absentDays, workingDays);
        
        // Update chart with weekly trend
        if (data.weekly_trend) {
            updateAttendanceTrendChart(data.weekly_trend);
        }
        
        // Update recent attendance
        if (data.recent_attendance) {
            // Make sure we have an array
            const recentAttendance = Array.isArray(data.recent_attendance) ? 
                data.recent_attendance : [];
            
            // Filter out any null/undefined items
            const validAttendance = recentAttendance.filter(item => 
                item && (item.status || item.date)
            );
            
            updateRecentAttendance(validAttendance);
        } else {
            // If no recent attendance data, show empty state
            updateRecentAttendance([]);
        }
        
    } catch (error) {
        console.error('Error updating dashboard UI:', error);
    }
}

function initializeRecentAttendance() {
    const recentContainer = document.getElementById('recentAttendanceContainer');
    if (!recentContainer) return;
    
    // Check if we have cached data first
    const cachedData = localStorage.getItem('dashboard_data');
    if (cachedData) {
        try {
            const data = JSON.parse(cachedData);
            if (data.recent_attendance && data.recent_attendance.length > 0) {
                // Show cached data while loading fresh data
                updateRecentAttendance(data.recent_attendance);
                return;
            }
        } catch (error) {
            console.error('Error parsing cached data:', error);
        }
    }
    
    // If no cached data, show loading state
    recentContainer.innerHTML = `
        <div class="p-8 text-center text-gray-400">
            <div class="flex items-center justify-center space-x-2">
                <div class="loading-spinner"></div>
                <span>Loading recent attendance...</span>
            </div>
        </div>
    `;
}

function updateUserInfo(studentInfo) {
    // Update user information display
    if (!studentInfo) return;
    
    try {
        // Update name elements
        const nameElements = [
            document.getElementById('studentName'),
            document.getElementById('dropdownStudentName'),
            document.getElementById('profileDisplayName'),
            document.getElementById('profileName')
        ];
        
        nameElements.forEach(el => {
            if (el && studentInfo.full_name) {
                el.textContent = studentInfo.full_name;
                if (el.id === 'profileName') {
                    el.value = studentInfo.full_name;
                }
            }
        });
        
        // Update email elements
        const emailElements = [
            document.getElementById('dropdownStudentEmail'),
            document.getElementById('profileEmail'),
            document.getElementById('profileDisplayEmail')
        ];
        
        emailElements.forEach(el => {
            if (el && studentInfo.email) {
                el.textContent = studentInfo.email;
                if (el.id === 'profileEmail') {
                    el.value = studentInfo.email;
                }
            }
        });
        
        // Update roll number
        const profileRollNo = document.getElementById('profileRollNo');
        if (profileRollNo && studentInfo.roll_no) {
            profileRollNo.textContent = studentInfo.roll_no;
        }
        
        // Update class and stream
        const profileClassStream = document.getElementById('profileClassStream');
        if (profileClassStream) {
            let classStreamText = '';
            if (studentInfo.standard) {
                classStreamText = studentInfo.standard;
                if (studentInfo.stream) {
                    classStreamText += ` - ${studentInfo.stream}`;
                }
            } else {
                classStreamText = 'Grade 10 - Science';
            }
            profileClassStream.textContent = classStreamText;
        }
        
        // Update section subtitle
        const sectionSubtitle = document.getElementById('sectionSubtitle');
        if (sectionSubtitle && studentInfo.full_name) {
            sectionSubtitle.textContent = `Welcome back, ${studentInfo.full_name}`;
        }
        
        // Update student class info
        const studentClassElement = document.getElementById('studentClass');
        if (studentClassElement) {
            if (studentInfo.standard && studentInfo.stream) {
                studentClassElement.textContent = `Class: ${studentInfo.standard} - ${studentInfo.stream}`;
            } else if (studentInfo.standard) {
                studentClassElement.textContent = `Class: ${studentInfo.standard}`;
            }
        }
        
        // Store in localStorage for offline use
        if (studentInfo.full_name) {
            localStorage.setItem('student_name', studentInfo.full_name);
        }
        if (studentInfo.email) {
            localStorage.setItem('user_email', studentInfo.email);
        }
        if (studentInfo.roll_no) {
            localStorage.setItem('student_roll_no', studentInfo.roll_no);
        }
        if (studentInfo.standard) {
            localStorage.setItem('student_class', studentInfo.standard);
        }
        if (studentInfo.stream) {
            localStorage.setItem('student_stream', studentInfo.stream);
        }
        
    } catch (error) {
        console.error('Error updating user info:', error);
    }
}

function updateAttendanceStatusText(percent) {
    const attendanceStatusText = document.getElementById('attendanceStatusText');
    if (!attendanceStatusText) return;
    
    if (percent >= 90) {
        attendanceStatusText.innerHTML = '<i class="fas fa-calendar-check mr-1"></i>Excellent';
        attendanceStatusText.className = 'text-green-400 text-sm';
    } else if (percent >= 75) {
        attendanceStatusText.innerHTML = '<i class="fas fa-calendar-check mr-1"></i>Good';
        attendanceStatusText.className = 'text-yellow-400 text-sm';
    } else if (percent >= 60) {
        attendanceStatusText.innerHTML = '<i class="fas fa-calendar-alt mr-1"></i>Fair';
        attendanceStatusText.className = 'text-yellow-400 text-sm';
    } else {
        attendanceStatusText.innerHTML = '<i class="fas fa-calendar-times mr-1"></i>Needs Improvement';
        attendanceStatusText.className = 'text-red-400 text-sm';
    }
}

function updateProgressBars(presentDays, absentDays, workingDays) {
    // Update the attendance summary section
    const presentPercent = workingDays > 0 ? (presentDays / workingDays * 100) : 0;
    const absentPercent = workingDays > 0 ? (absentDays / workingDays * 100) : 0;
    
    // Update present progress bar
    const presentProgress = document.querySelector('.progress-fill[style*="width: 81%"]');
    if (presentProgress) {
        presentProgress.style.width = presentPercent.toFixed(1) + '%';
    }
    
    // Update absent progress bar
    const absentProgress = document.querySelector('.progress-fill.bg-red-500');
    if (absentProgress) {
        absentProgress.style.width = absentPercent.toFixed(1) + '%';
    }
    
    // Update the text values in attendance summary
    const presentText = document.querySelector('#dashboardTab .glass-card .space-y-4 div:first-child span:last-child');
    if (presentText && presentText.classList.contains('text-green-400')) {
        presentText.textContent = presentDays;
    }
    
    const absentText = document.querySelector('#dashboardTab .glass-card .space-y-4 div:nth-child(2) span:last-child');
    if (absentText && absentText.classList.contains('text-red-400')) {
        absentText.textContent = absentDays;
    }
}

function updateRecentAttendance(recentAttendance) {
    const recentContainer = document.getElementById('recentAttendanceContainer');
    
    if (!recentContainer) {
        console.error('Recent attendance container not found');
        return;
    }
    
    // Clear the container
    recentContainer.innerHTML = '';
    
    // Check if we have valid data
    if (!recentAttendance || recentAttendance.length === 0) {
        recentContainer.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-400 py-8">
                <i class="fas fa-calendar-alt text-3xl mb-3 opacity-50"></i>
                <p class="text-sm font-medium mb-1">No recent attendance data</p>
                <p class="text-xs opacity-75">Attendance records will appear here</p>
            </div>
        `;
        return;
    }
    
    // Create a wrapper for attendance items
    const itemsWrapper = document.createElement('div');
    itemsWrapper.className = 'space-y-3 pb-2';
    
    // Show recent attendance items
    const itemsToShow = Math.min(recentAttendance.length, 3);
    let hasValidItems = false;
    
    for (let i = 0; i < itemsToShow; i++) {
        const attendance = recentAttendance[i];
        
        // Skip invalid items
        if (!attendance || (!attendance.status && !attendance.date)) {
            continue;
        }
        
        hasValidItems = true;
        
        // Process attendance data
        let status = attendance.status;
        let statusClass = '';
        let bgClass = '';
        let icon = '';
        
        // Convert status
        if (status === 'PRESENT' || status === 'PRESENT_FULL_DAY' || 
            status === 'LATE' || status === 'HALF_DAY') {
            status = 'Present';
            statusClass = 'badge-success';
            bgClass = 'bg-green-900/20 border border-green-900/30';
            icon = 'fa-check-circle';
        } else if (status === 'ABSENT' || status === 'LEAVE') {
            status = 'Absent';
            statusClass = 'badge-danger';
            bgClass = 'bg-red-900/20 border border-red-900/30';
            icon = 'fa-times-circle';
        } else {
            status = 'Present';
            statusClass = 'badge-success';
            bgClass = 'bg-green-900/20 border border-green-900/30';
            icon = 'fa-check-circle';
        }
        
        // Format date
        let displayDate = '';
        if (attendance.formatted_date) {
            displayDate = attendance.formatted_date;
        } else if (attendance.date) {
            try {
                const dateObj = new Date(attendance.date);
                if (!isNaN(dateObj.getTime())) {
                    displayDate = dateObj.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                    });
                } else {
                    displayDate = 'Invalid date';
                }
            } catch (error) {
                displayDate = 'Invalid date';
            }
        } else {
            displayDate = '--/--';
        }
        
        // Get day name
        let dayName = attendance.day_name || '';
        if (!dayName && attendance.date) {
            try {
                const dateObj = new Date(attendance.date);
                if (!isNaN(dateObj.getTime())) {
                    dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                }
            } catch (error) {
                dayName = '';
            }
        }
        
        // Create attendance item
        const item = document.createElement('div');
        item.className = `flex items-center justify-between p-3 rounded-xl ${bgClass} transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`;
        
        item.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center ${status === 'Present' ? 'bg-green-900/40' : 'bg-red-900/40'}">
                    <i class="fas ${icon} ${status === 'Present' ? 'text-green-400' : 'text-red-400'}"></i>
                </div>
                <div>
                    <p class="font-medium text-sm">${dayName}</p>
                    <p class="text-xs text-gray-400 mt-0.5">${displayDate}</p>
                    ${attendance.time_in && attendance.time_in !== '--' && attendance.time_in !== 'N/A' ? 
                        `<p class="text-xs text-gray-500 mt-1"><i class="fas fa-clock mr-1"></i>${attendance.time_in}</p>` : ''}
                </div>
            </div>
            <span class="badge ${statusClass} px-3 py-1.5 text-xs font-medium">${status}</span>
        `;
        
        itemsWrapper.appendChild(item);
    }
    
    if (hasValidItems) {
        recentContainer.appendChild(itemsWrapper);
        
        // Add view all link if there are more records
        if (recentAttendance.length > 6) {
            const viewAllLink = document.createElement('div');
            viewAllLink.className = 'pt-4 border-t border-gray-800 mt-4';
            viewAllLink.innerHTML = `
                <button onclick="setActiveTab('attendanceRecords')" 
                        class="w-full text-indigo-400 hover:text-indigo-300 text-sm flex items-center justify-center space-x-1 group transition-colors duration-200">
                    <span>View All Records (${recentAttendance.length})</span>
                    <i class="fas fa-chevron-right text-xs group-hover:translate-x-1 transition-transform duration-200"></i>
                </button>
            `;
            recentContainer.appendChild(viewAllLink);
        }
    } else {
        recentContainer.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-400 py-8">
                <i class="fas fa-calendar-alt text-3xl mb-3 opacity-50"></i>
                <p class="text-sm font-medium mb-1">No recent attendance data</p>
                <p class="text-xs opacity-75">Attendance records will appear here</p>
            </div>
        `;
    }
}

function updateSidebarStats(data) {
    const sidebarStats = data.sidebar_stats || data.monthly_stats || {};
    
    const presentDays = sidebarStats.present_days || 0;
    const absentDays = sidebarStats.absent_days || 0;
    const attendancePercent = sidebarStats.attendance_percent || 0;
    const workingDays = sidebarStats.working_days || 0;
    
    // Calculate leaves left (assuming 2 leaves per month)
    const leavesUsed = data.monthly_stats?.leaves_used || 0;
    const leavesLeft = Math.max(0, 2 - leavesUsed);
    
    document.getElementById('sidebarPresentDays').textContent = presentDays;
    document.getElementById('sidebarAbsentDays').textContent = absentDays;
    document.getElementById('sidebarAttendancePercent').textContent = attendancePercent.toFixed(1) + '%';
    document.getElementById('sidebarLeavesLeft').textContent = leavesLeft;
}

// ==================== CHART FUNCTIONS ====================
function loadAttendanceTrendChart() {
    const ctx = document.getElementById('attendanceTrendChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (charts.attendanceTrend) {
        charts.attendanceTrend.destroy();
    }
    
    // Get theme-specific colors
    const isDarkTheme = document.body.classList.contains('dark');
    const textColor = isDarkTheme ? '#e2e8f0' : '#334155';
    const gridColor = isDarkTheme ? '#334155' : '#e2e8f0';
    const tooltipBg = isDarkTheme ? '#1e293b' : '#ffffff';
    const pointBorderColor = isDarkTheme ? '#0f172a' : '#ffffff';
    
    // Initial chart - will be updated with real data
    charts.attendanceTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Loading...'],
            datasets: [{
                label: 'Attendance %',
                data: [0],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: pointBorderColor,
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
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

function updateAttendanceTrendChart(weeklyData) {
    const ctx = document.getElementById('attendanceTrendChart')?.getContext('2d');
    if (!ctx) return;
    
    // If chart doesn't exist, create it
    if (!charts.attendanceTrend) {
        loadAttendanceTrendChart();
        // Wait a bit for chart to initialize, then update
        setTimeout(() => {
            updateAttendanceTrendChart(weeklyData);
        }, 100);
        return;
    }
    
    // Update chart with real data
    const labels = weeklyData.map(week => week.week);
    const dataPoints = weeklyData.map(week => week.attendance_percent);
    
    charts.attendanceTrend.data.labels = labels;
    charts.attendanceTrend.data.datasets[0].data = dataPoints;
    
    // Update theme colors if needed
    const isDarkTheme = document.body.classList.contains('dark');
    const textColor = isDarkTheme ? '#e2e8f0' : '#334155';
    const gridColor = isDarkTheme ? '#334155' : '#e2e8f0';
    const tooltipBg = isDarkTheme ? '#1e293b' : '#ffffff';
    const pointBorderColor = isDarkTheme ? '#0f172a' : '#ffffff';
    
    // Update chart options with new theme colors
    charts.attendanceTrend.options.plugins.legend.labels.color = textColor;
    charts.attendanceTrend.options.plugins.tooltip.backgroundColor = tooltipBg;
    charts.attendanceTrend.options.plugins.tooltip.titleColor = textColor;
    charts.attendanceTrend.options.plugins.tooltip.bodyColor = textColor;
    
    charts.attendanceTrend.options.scales.x.grid.color = gridColor;
    charts.attendanceTrend.options.scales.x.ticks.color = textColor;
    
    charts.attendanceTrend.options.scales.y.grid.color = gridColor;
    charts.attendanceTrend.options.scales.y.ticks.color = textColor;
    
    // Update point border color
    charts.attendanceTrend.data.datasets[0].pointBorderColor = pointBorderColor;
    
    charts.attendanceTrend.update();
}

function loadCurrentMonthTrend() {
    showToast('Loading current month trend...', 'info');
    // Refresh dashboard data
    loadDashboardData();
}

function loadLastMonthTrend() {
    showToast('Loading last month trend...', 'info');
    // This would call a specific API for last month data
    // For now, just refresh dashboard
    loadDashboardData();
}

function loadQuarterTrend() {
    showToast('Loading 3-month trend...', 'info');
    // This would call a specific API for quarter data
    // For now, just refresh dashboard
    loadDashboardData();
}

// ==================== CALENDAR FUNCTIONS ====================
async function generateCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth(); // JavaScript months are 0-indexed
    
    // Update month display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    // Use month+1 for API call (since API expects 1-indexed months)
    try {
        // Fetch calendar data from API
        const response = await fetch(`${API_BASE_URL}/attendance/calendar/${year}/${month + 1}`, {
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            return;
        }
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                renderCalendar(result.data);
                return;
            }
        }
        
        // If API fails, show fallback calendar
        showFallbackCalendar(year, month + 1);
        
    } catch (error) {
        console.error('Error loading calendar data:', error);
        showFallbackCalendar(year, month + 1);
    }
}

function showFallbackCalendar(year, month) {
    const calendarDays = document.getElementById('calendarDays');
    if (!calendarDays) return;
    
    calendarDays.innerHTML = '';
    
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    
    // Update the calendar title in fallback too
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('currentMonth').textContent = `${monthNames[month - 1]} ${year}`;
    
    // Add empty cells
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day opacity-30';
        calendarDays.appendChild(emptyDay);
    }
    
    // Add days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const date = new Date(year, month - 1, day);
        
        // Check if today
        if (date.getDate() === today.getDate() && 
            date.getMonth() === today.getMonth() && 
            date.getFullYear() === today.getFullYear()) {
            dayElement.classList.add('today');
        }
        
        // Mark weekends
        if (date.getDay() === 0 || date.getDay() === 6) {
            dayElement.classList.add('opacity-50');
            dayElement.title = 'Weekend';
        }
        
        calendarDays.appendChild(dayElement);
    }
}

function renderCalendar(calendarData) {
    const calendarDays = document.getElementById('calendarDays');
    if (!calendarDays) return;
    
    calendarDays.innerHTML = '';
    
    // Add empty cells for days before the first day of month
    const firstDay = new Date(calendarData.year, calendarData.month - 1, 1).getDay();
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day';
        calendarDays.appendChild(emptyDay);
    }
    
    // Add days of the month
    calendarData.calendar_data.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day.day;
        
        // Add classes based on status
        if (day.is_today) {
            dayElement.classList.add('today');
        }
        
        if (day.status === 'PRESENT' && !day.is_weekend) {
            dayElement.classList.add('present');
        } else if (day.status === 'ABSENT' && !day.is_weekend && day.is_working_day) {
            dayElement.classList.add('absent');
        }
        
        // Add title with time info if present
        if (day.status === 'PRESENT' && day.time_in) {
            dayElement.title = `Present - Checked in at ${day.time_in}`;
        } else if (day.is_weekend) {
            dayElement.title = 'Weekend';
            dayElement.classList.add('opacity-50');
        }
        
        calendarDays.appendChild(dayElement);
    });
}

function prevMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    generateCalendar();
}

function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    // Don't allow going to future months beyond current month
    const now = new Date();
    const nextMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1);
    if (nextMonth > now) {
        // If next month would be in the future, reset to current month
        currentCalendarDate = new Date();
        showToast('Cannot view future months', 'info');
    }
    generateCalendar();
}

// ==================== ATTENDANCE RECORDS ====================
async function loadAttendanceRecords() {
    showLoading('Loading attendance records...');
    
    try {
        // Get filter values
        const monthFilter = document.getElementById('filterMonth').value;
        const yearFilter = document.getElementById('filterYear').value;
        
        // Build API URL with filters
        let apiUrl = `${API_BASE_URL}/attendance/records`;
        const params = new URLSearchParams();
        
        if (monthFilter && monthFilter !== 'all') {
            params.append('month', monthFilter);
        }
        if (yearFilter && yearFilter !== 'all') {
            params.append('year', yearFilter);
        }
        
        if (params.toString()) {
            apiUrl += `?${params.toString()}`;
        }
        
        const response = await fetch(apiUrl, {
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            hideLoading();
            return;
        }
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            allAttendanceRecords = result.data.records;
            updateAttendanceRecordsStats(result.data);
            renderAttendanceRecordsTable();
        } else {
            throw new Error(result.message || 'Failed to load attendance records');
        }
        
    } catch (error) {
        console.error('Error loading attendance records:', error);
        showToast('Error loading attendance records', 'error');
        
        // Fallback: Load data without filters if API fails
        loadAttendanceRecordsFallback();
    } finally {
        hideLoading();
    }
}

async function loadAttendanceRecordsFallback() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Set default filters
    document.getElementById('filterMonth').value = currentMonth;
    document.getElementById('filterYear').value = currentYear;
    
    // Show fallback data
    showFallbackAttendanceData();
}

function showFallbackAttendanceData() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Create fallback data for demonstration
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Generate some sample records for current month
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const fallbackRecords = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth - 1, day);
        // Skip weekends for sample data
        if (date.getDay() !== 0 && date.getDay() !== 6) {
            const isPresent = Math.random() > 0.2; // 80% chance of being present
            const status = isPresent ? 'PRESENT' : 'ABSENT';
            
            fallbackRecords.push({
                id: day,
                date: date.toISOString().split('T')[0],
                formatted_date: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                day_name: date.toLocaleDateString('en-US', { weekday: 'long' }),
                status: status,
                time_in: isPresent ? '09:' + (Math.floor(Math.random() * 60)).toString().padStart(2, '0') + ' AM' : '--',
                recorded_by: 'System',
                remarks: isPresent ? 'Regular attendance' : 'No attendance recorded',
                is_working_day: true
            });
        }
    }
    
    allAttendanceRecords = fallbackRecords.reverse(); // Show newest first
    updateFallbackStats();
    renderAttendanceRecordsTable();
}

function updateFallbackStats() {
    const total = allAttendanceRecords.length;
    const present = allAttendanceRecords.filter(r => r.status === 'PRESENT').length;
    const attendancePercent = total > 0 ? Math.round((present / total) * 100) : 0;
    
    document.getElementById('recordsTotalDays').textContent = total;
    document.getElementById('recordsPresentDays').textContent = present;
    document.getElementById('recordsAbsentDays').textContent = total - present;
    document.getElementById('recordsAttendancePercent').textContent = attendancePercent + '%';
}

function updateAttendanceRecordsStats(data) {
    const present = allAttendanceRecords.filter(r => r.status === 'PRESENT').length;
    const total = allAttendanceRecords.length;
    const attendancePercent = total > 0 ? Math.round((present / total) * 100) : 0;
    
    document.getElementById('recordsTotalDays').textContent = total;
    document.getElementById('recordsPresentDays').textContent = present;
    document.getElementById('recordsAbsentDays').textContent = total - present;
    document.getElementById('recordsAttendancePercent').textContent = attendancePercent + '%';
}

function renderAttendanceRecordsTable() {
    const tableBody = document.getElementById('attendanceRecordsTableBody');
    if (!tableBody) return;
    
    // Remove loading row
    const loadingRow = document.getElementById('attendanceRecordsLoadingRow');
    if (loadingRow) loadingRow.remove();
    
    // Get filtered records
    const filteredRecords = filterAttendanceRecordsList(allAttendanceRecords);
    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
    const startIndex = (currentRecordsPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const pageRecords = filteredRecords.slice(startIndex, endIndex);
    
    tableBody.innerHTML = '';
    
    if (pageRecords.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-gray-400">
                    <i class="fas fa-calendar-alt text-3xl mb-3"></i>
                    <p class="text-lg">No attendance records found</p>
                    <p class="text-sm mt-1">Try adjusting your filters</p>
                </td>
            </tr>
        `;
    } else {
        pageRecords.forEach(record => {
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
            } else if (record.status === 'LEAVE') {
                statusBadge = 'Leave';
                statusColor = 'badge-purple';
            }
            
            row.innerHTML = `
                <td class="p-4">${record.formatted_date}</td>
                <td class="p-4">${record.day_name}</td>
                <td class="p-4">
                    <span class="badge ${statusColor}">${statusBadge}</span>
                </td>
                <td class="p-4">${record.time_in}</td>
                <td class="p-4 text-gray-400">${record.remarks || '-'}</td>
                <td class="p-4 text-gray-400">${record.recorded_by}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    // Update table info and pagination
    document.getElementById('attendanceRecordsTableInfo').textContent = 
        `Showing ${startIndex + 1}-${Math.min(endIndex, filteredRecords.length)} of ${filteredRecords.length} records`;
    
    updatePagination('attendanceRecordsPagination', currentRecordsPage, totalPages, 'changeRecordsPage');
}

function filterAttendanceRecordsList(records) {
    const monthFilter = document.getElementById('filterMonth').value;
    const yearFilter = document.getElementById('filterYear').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const searchTerm = document.getElementById('searchAttendance').value.toLowerCase();
    
    return records.filter(record => {
        const recordDate = new Date(record.date);
        const recordMonth = recordDate.getMonth() + 1; // JavaScript months are 0-indexed
        const recordYear = recordDate.getFullYear();
        
        // Filter by month
        if (monthFilter !== 'all' && String(recordMonth) !== monthFilter) {
            return false;
        }
        
        // Filter by year
        if (yearFilter !== 'all' && String(recordYear) !== yearFilter) {
            return false;
        }
        
        // Filter by status
        if (statusFilter !== 'all' && record.status !== statusFilter) {
            return false;
        }
        
        // Filter by search term
        if (searchTerm && !record.formatted_date.toLowerCase().includes(searchTerm) &&
            !record.day_name.toLowerCase().includes(searchTerm) &&
            !record.remarks.toLowerCase().includes(searchTerm)) {
            return false;
        }
        
        return true;
    });
}

async function filterAttendanceRecords() {
    showLoading('Filtering attendance records...');
    
    try {
        // Get current filter values
        const monthFilter = document.getElementById('filterMonth').value;
        const yearFilter = document.getElementById('filterYear').value;
        const statusFilter = document.getElementById('filterStatus').value;
        const searchTerm = document.getElementById('searchAttendance').value.toLowerCase();
        
        // If "all" is selected for month/year, we need to call a different API endpoint
        // or handle filtering locally
        if (monthFilter === 'all' || yearFilter === 'all') {
            // Load all records and filter locally
            await loadAllAttendanceRecords();
        } else {
            // Call API with specific month/year
            const response = await fetch(`${API_BASE_URL}/attendance/records?month=${monthFilter}&year=${yearFilter}`, {
                headers: getHeaders()
            });
            
            if (checkTokenExpired(response)) {
                hideLoading();
                return;
            }
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                allAttendanceRecords = result.data.records;
                updateAttendanceRecordsStats(result.data);
            } else {
                throw new Error(result.message || 'Failed to load filtered records');
            }
        }
        
        // Apply local filters (status and search)
        currentRecordsPage = 1;
        renderAttendanceRecordsTable();
        
    } catch (error) {
        console.error('Error filtering records:', error);
        showToast('Error filtering records', 'error');
    } finally {
        hideLoading();
    }
}

async function loadAllAttendanceRecords() {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/records`, {
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            throw new Error('Token expired');
        }
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            allAttendanceRecords = result.data.records;
        } else {
            throw new Error(result.message || 'Failed to load all records');
        }
    } catch (error) {
        console.error('Error loading all records:', error);
        throw error;
    }
}

function changeRecordsPage(page) {
    currentRecordsPage = page;
    renderAttendanceRecordsTable();
}

// ==================== LEAVE REQUEST FUNCTIONS ====================
async function loadLeaveRequests() {
    try {
        const response = await fetch(`${API_BASE_URL}/leave-requests`, {
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            return;
        }
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                leaveRequests = result.data;
                updateLeaveStats();
                renderLeaveHistoryTable();
            }
        } else {
            showToast('This feature is coming soon', 'error');
        }
    } catch (error) {
        console.error('Error loading leave requests:', error);
        showToast('Error loading leave requests', 'error');
    }
}

function updateLeaveStats() {
    // These would come from API
    const totalLeaves = 12; // Annual leaves allocated
    const leavesUsed = leaveRequests.filter(r => r.status === 'APPROVED').length;
    const leavesLeft = Math.max(0, totalLeaves - leavesUsed);
    const pendingRequests = leaveRequests.filter(r => r.status === 'PENDING').length;
    
    document.getElementById('totalLeaves').textContent = totalLeaves;
    document.getElementById('leavesUsed').textContent = leavesUsed;
    document.getElementById('leavesLeft').textContent = leavesLeft;
    document.getElementById('pendingRequests').textContent = pendingRequests;
}

function renderLeaveHistoryTable() {
    const tableBody = document.getElementById('leaveHistoryTableBody');
    if (!tableBody) return;
    
    if (!leaveRequests || leaveRequests.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-gray-400">
                    <i class="fas fa-envelope text-3xl mb-3"></i>
                    <p class="text-lg">No leave requests found</p>
                    <p class="text-sm mt-1">Submit your first leave request using the form above</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = '';
    
    leaveRequests.forEach(request => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
        
        let statusBadge = '';
        let statusColor = '';
        
        switch(request.status) {
            case 'PENDING':
                statusBadge = 'Pending';
                statusColor = 'badge-warning';
                break;
            case 'APPROVED':
                statusBadge = 'Approved';
                statusColor = 'badge-success';
                break;
            case 'REJECTED':
                statusBadge = 'Rejected';
                statusColor = 'badge-danger';
                break;
            default:
                statusBadge = request.status;
                statusColor = 'badge-info';
        }
        
        // Format dates
        const appliedDate = new Date(request.applied_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        let leaveDates = '';
        if (request.start_date && request.end_date) {
            const startDate = new Date(request.start_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            const endDate = new Date(request.end_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            leaveDates = `${startDate} - ${endDate}`;
        } else if (request.leave_date) {
            const leaveDate = new Date(request.leave_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            leaveDates = leaveDate + (request.half_day_type ? ` (${request.half_day_type})` : '');
        }
        
        row.innerHTML = `
            <td class="p-4">${appliedDate}</td>
            <td class="p-4">${leaveDates}</td>
            <td class="p-4">${request.type}</td>
            <td class="p-4 text-gray-400">${request.reason.substring(0, 50)}${request.reason.length > 50 ? '...' : ''}</td>
            <td class="p-4">
                <span class="badge ${statusColor}">${statusBadge}</span>
            </td>
            <td class="p-4">
                <div class="flex space-x-2">
                    <button onclick="viewLeaveRequest(${request.id})" 
                            class="px-3 py-1 rounded-lg border border-blue-500 text-blue-400 hover:bg-blue-900/30 text-sm">
                        <i class="fas fa-eye mr-1"></i> View
                    </button>
                    ${request.status === 'PENDING' ? `
                    <button onclick="cancelLeaveRequest(${request.id})" 
                            class="px-3 py-1 rounded-lg border border-red-500 text-red-400 hover:bg-red-900/30 text-sm">
                        <i class="fas fa-times mr-1"></i> Cancel
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function toggleLeaveDuration() {
    const duration = document.getElementById('leaveDuration').value;
    
    // Hide all fields first
    document.getElementById('singleDateField').classList.add('hidden');
    document.getElementById('startDateField').classList.add('hidden');
    document.getElementById('endDateField').classList.add('hidden');
    document.getElementById('halfDayField').classList.add('hidden');
    
    // Show relevant fields
    if (duration === 'SINGLE') {
        document.getElementById('singleDateField').classList.remove('hidden');
    } else if (duration === 'MULTIPLE') {
        document.getElementById('startDateField').classList.remove('hidden');
        document.getElementById('endDateField').classList.remove('hidden');
    } else if (duration === 'HALF') {
        document.getElementById('singleDateField').classList.remove('hidden');
        document.getElementById('halfDayField').classList.remove('hidden');
    }
}

function openNewLeaveModal() {
    // Scroll to the form
    document.getElementById('leaveRequestForm').scrollIntoView({ behavior: 'smooth' });
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    document.getElementById('leaveSingleDate').value = tomorrowStr;
    document.getElementById('leaveStartDate').value = tomorrowStr;
    
    // Set end date to tomorrow for multiple days
    document.getElementById('leaveEndDate').value = tomorrowStr;
    
    showToast('Fill in the form to submit a leave request', 'info');
}

function resetLeaveForm() {
    document.getElementById('newLeaveForm').reset();
    toggleLeaveDuration();
}

async function submitLeaveRequest() {
    const leaveType = document.getElementById('leaveType').value;
    const leaveDuration = document.getElementById('leaveDuration').value;
    const leaveReason = document.getElementById('leaveReason').value;
    
    // Get dates based on duration
    let leaveDate, startDate, endDate, halfDayType;
    
    if (leaveDuration === 'SINGLE') {
        leaveDate = document.getElementById('leaveSingleDate').value;
    } else if (leaveDuration === 'MULTIPLE') {
        startDate = document.getElementById('leaveStartDate').value;
        endDate = document.getElementById('leaveEndDate').value;
    } else if (leaveDuration === 'HALF') {
        leaveDate = document.getElementById('leaveSingleDate').value;
        halfDayType = document.getElementById('leaveHalfDay').value;
    }
    
    // Validation
    if (!leaveType || !leaveReason) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (leaveDuration === 'SINGLE' && !leaveDate) {
        showToast('Please select a date', 'error');
        return;
    }
    
    if (leaveDuration === 'MULTIPLE' && (!startDate || !endDate)) {
        showToast('Please select both start and end dates', 'error');
        return;
    }
    
    if (leaveDuration === 'HALF' && (!leaveDate || !halfDayType)) {
        showToast('Please select a date and half day type', 'error');
        return;
    }
    
    const leaveData = {
        type: leaveType,
        duration: leaveDuration,
        reason: leaveReason
    };
    
    if (leaveDate) leaveData.leave_date = leaveDate;
    if (startDate) leaveData.start_date = startDate;
    if (endDate) leaveData.end_date = endDate;
    if (halfDayType) leaveData.half_day_type = halfDayType;
    
    showLoading('Submitting leave request...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/leave-requests`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(leaveData)
        });
        
        if (checkTokenExpired(response)) {
            hideLoading();
            return;
        }
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showToast('Leave request submitted successfully!', 'success');
                resetLeaveForm();
                loadLeaveRequests(); // Refresh leave requests
            } else {
                showToast(result.message || 'Failed to submit leave request', 'error');
            }
        } else {
            const errorData = await response.json();
            showToast(errorData.detail || 'Failed to submit leave request', 'error');
        }
    } catch (error) {
        console.error('Error submitting leave request:', error);
        showToast('Error submitting leave request', 'error');
    } finally {
        hideLoading();
    }
}

async function viewLeaveRequest(requestId) {
    try {
        const response = await fetch(`${API_BASE_URL}/leave-requests/${requestId}`, {
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            return;
        }
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                const request = result.data;
                
                // Show modal with request details
                alert(`Leave Request Details:\n\nType: ${request.type}\nStatus: ${request.status}\nDates: ${request.leave_date || `${request.start_date} to ${request.end_date}`}\nReason: ${request.reason}\nApplied on: ${new Date(request.applied_at).toLocaleDateString()}`);
            }
        }
    } catch (error) {
        console.error('Error viewing leave request:', error);
        showToast('Error viewing leave request', 'error');
    }
}

async function cancelLeaveRequest(requestId) {
    if (!confirm('Are you sure you want to cancel this leave request?')) {
        return;
    }
    
    showLoading('Cancelling leave request...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/leave-requests/${requestId}/cancel`, {
            method: 'POST',
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            hideLoading();
            return;
        }
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showToast('Leave request cancelled successfully!', 'success');
                loadLeaveRequests(); // Refresh leave requests
            } else {
                showToast(result.message || 'Failed to cancel leave request', 'error');
            }
        } else {
            const errorData = await response.json();
            showToast(errorData.detail || 'Failed to cancel leave request', 'error');
        }
    } catch (error) {
        console.error('Error cancelling leave request:', error);
        showToast('Error cancelling leave request', 'error');
    } finally {
        hideLoading();
    }
}

// ==================== PROFILE MANAGEMENT ====================
function initProfileSection() {
    loadProfileData();
    
    // Setup password strength checker
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
}

async function loadProfileData() {
    showLoading('Loading profile...');
    
    try {
        // Load profile from API
        const response = await fetch(`http://localhost:8000/users/profile`, {
            headers: getHeaders()
        });
        
        if (checkTokenExpired(response)) {
            hideLoading();
            return;
        }
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                updateProfileDisplay(data.data);
            } else {
                useStoredProfileData();
            }
        } else {
            useStoredProfileData();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        useStoredProfileData();
    } finally {
        hideLoading();
    }
    
    // Update theme display
    const profileTheme = document.getElementById('profileTheme');
    if (profileTheme) {
        profileTheme.textContent = currentTheme === 'dark' ? 'Dark' : 'Light';
    }
}

function updateProfileDisplay(profileData) {
    // Update name and email
    const displayName = profileData.full_name || profileData.email?.split('@')[0] || 'Student';
    const email = profileData.email || 'student@neuroface.ai';
    
    updateNameDisplay(displayName);
    updateEmailDisplay(email);
    
    // Populate profile form
    populateProfileForm(displayName, email);
    
    // Update academic information in profile section
    updateAcademicInfoInProfile(profileData);
    
    // Also update academic info in other sections if they're visible
    updateAcademicInfoEverywhere(profileData);
}

function updateAcademicInfoInProfile(profileData) {
    // Update roll number in profile section
    const profileRollNo = document.getElementById('profileRollNo');
    if (profileRollNo && profileData.roll_no) {
        profileRollNo.textContent = profileData.roll_no;
    }
    
    // Update class & stream in profile section
    const profileClassStream = document.getElementById('profileClassStream');
    if (profileClassStream) {
        let classStreamText = '';
        if (profileData.class) {
            classStreamText = profileData.class;
            if (profileData.stream) {
                classStreamText += ` - ${profileData.stream}`;
            }
        } else {
            classStreamText = 'Grade 10 - Science';
        }
        profileClassStream.textContent = classStreamText;
    }
    
    // Update profile role badge
    const profileRoleBadge = document.getElementById('profileRoleBadge');
    if (profileRoleBadge && profileData.role) {
        profileRoleBadge.textContent = profileData.role;
        
        // Style based on role
        if (profileData.role === 'STUDENT') {
            profileRoleBadge.className = 'mt-2 px-3 py-1 rounded-full text-xs bg-indigo-900/30 text-indigo-400';
        } else if (profileData.role === 'ADMIN') {
            profileRoleBadge.className = 'mt-2 px-3 py-1 rounded-full text-xs bg-purple-900/30 text-purple-400';
        }
    }
}

function updateAcademicInfoEverywhere(profileData) {
    // Update student class in header dropdown
    const studentClassElement = document.getElementById('studentClass');
    if (studentClassElement) {
        if (profileData.class && profileData.stream) {
            studentClassElement.textContent = `Class: ${profileData.class} - ${profileData.stream}`;
        } else if (profileData.class) {
            studentClassElement.textContent = `Class: ${profileData.class}`;
        }
    }
    
    // Update academic info in academic tab
    updateAcademicTabInfo(profileData);
}

function updateAcademicTabInfo(profileData) {
    // Update academic info tab if it exists
    const academicRollNo = document.getElementById('academicRollNo');
    const academicClass = document.getElementById('academicClass');
    const academicStream = document.getElementById('academicStream');
    const academicSection = document.getElementById('academicSection');
    
    if (academicRollNo && profileData.roll_no) {
        academicRollNo.textContent = profileData.roll_no;
    }
    
    if (academicClass && profileData.class) {
        academicClass.textContent = profileData.class;
    }
    
    if (academicStream && profileData.stream) {
        academicStream.textContent = profileData.stream;
    }
}

function useStoredProfileData() {
    // Use stored data from localStorage
    const displayName = localStorage.getItem('student_name') || 'Student';
    const email = localStorage.getItem('user_email') || 'student@neuroface.ai';
    const rollNo = localStorage.getItem('student_roll_no');
    const studentClass = localStorage.getItem('student_class');
    const studentStream = localStorage.getItem('student_stream');
    
    const storedProfileData = {
        full_name: displayName,
        email: email,
        roll_no: rollNo,
        class: studentClass,
        stream: studentStream,
        role: 'STUDENT'
    };
    
    updateProfileDisplay(storedProfileData);
}

function updateNameDisplay(name) {
    const nameElements = [
        document.getElementById('studentName'),
        document.getElementById('dropdownStudentName'),
        document.getElementById('profileDisplayName'),
        document.getElementById('sectionSubtitle'),
        document.getElementById('profileName')
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
        document.getElementById('dropdownStudentEmail'),
        document.getElementById('profileEmail'),
        document.getElementById('profileDisplayEmail')
    ];
    
    emailElements.forEach(el => {
        if (el) el.textContent = email;
    });
}

function populateProfileForm(name, email) {
    const profileNameInput = document.getElementById('profileName');
    const profileEmailInput = document.getElementById('profileEmail');
    
    if (profileNameInput) profileNameInput.value = name || '';
    if (profileEmailInput) profileEmailInput.value = email || '';
}

function updateProfileName() {
    const nameInput = document.getElementById('profileName');
    
    if (!nameInput) return;
    
    const newName = nameInput.value.trim();
    
    if (newName) {
        localStorage.setItem('student_name', newName);
        updateNameDisplay(newName);
        showToast('Display name updated successfully!', 'success');
    } else {
        localStorage.removeItem('student_name');
        loadProfileData();
        showToast('Display name removed. Using email-based name.', 'info');
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
    
    showLoading('Updating email...');
    
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
        
        if (checkTokenExpired(response)) {
            hideLoading();
            return;
        }
        
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
    
    showLoading('Changing password...');
    
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
        
        if (checkTokenExpired(response)) {
            hideLoading();
            return;
        }
        
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

// ==================== UTILITY FUNCTIONS ====================
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
    
    // Update the attendance trend chart with new theme
    if (charts.attendanceTrend) {
        // Get the current data from the chart
        const chartData = charts.attendanceTrend.data;
        
        // Check if we have real data or just placeholder
        if (chartData.labels.length > 1 || chartData.labels[0] !== 'Loading...') {
            // We have real data, recreate the chart with current data
            const weeklyData = chartData.labels.map((label, index) => ({
                week: label,
                attendance_percent: chartData.datasets[0].data[index]
            }));
            
            // Recreate chart
            loadAttendanceTrendChart();
            
            // Update with current data
            setTimeout(() => {
                updateAttendanceTrendChart(weeklyData);
            }, 50);
        } else {
            // Just reload the empty chart with new theme
            loadAttendanceTrendChart();
        }
    }
    
    // Regenerate calendar with new theme
    generateCalendar();
}

function populateMonthFilter() {
    const monthFilter = document.getElementById('filterMonth');
    if (!monthFilter) return;
    
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    monthFilter.innerHTML = '<option value="all">All Months</option>';
    
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index + 1; // JavaScript months are 0-indexed, but our API expects 1-indexed
        option.textContent = month;
        monthFilter.appendChild(option);
    });
    
    // Set current month as default
    const currentMonth = new Date().getMonth() + 1;
    monthFilter.value = currentMonth;
}

// Function to populate year filter dynamically
function populateYearFilter() {
    const yearFilter = document.getElementById('filterYear');
    if (!yearFilter) return;
    
    const currentYear = new Date().getFullYear();
    const startYear = 2025; 
    
    yearFilter.innerHTML = '';
    
    // Add "All Years" option
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Years';
    yearFilter.appendChild(allOption);
    
    // Only show current year and previous years (NOT future years)
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    }
    
    // Set current year as default
    yearFilter.value = currentYear;
}

function setActiveTab(tabName) {
    // Hide all tabs
    const tabs = ['dashboardTab', 'attendanceRecordsTab', 'academicInfoTab', 'leaveRequestTab', 'profileSection'];
    tabs.forEach(tab => {
        const element = document.getElementById(tab);
        if (element) {
            element.classList.add('hidden');
        }
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected tab
    const tabElement = document.getElementById(tabName === 'profile' ? 'profileSection' : tabName + 'Tab');
    if (tabElement) {
        tabElement.classList.remove('hidden');
        tabElement.classList.add('fade-in');
    }
    
    // Add active class to clicked nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.textContent.includes(tabName.charAt(0).toUpperCase() + tabName.slice(1)) || 
            (tabName === 'attendanceRecords' && link.textContent.includes('Attendance Records')) ||
            (tabName === 'academicInfo' && link.textContent.includes('Academic Info')) ||
            (tabName === 'leaveRequest' && link.textContent.includes('Leave Request'))) {
            link.classList.add('active');
        }
    });
    
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    const sectionSubtitle = document.getElementById('sectionSubtitle');
    
    const titles = {
        'dashboard': 'Student Dashboard',
        'attendanceRecords': 'Attendance Records',
        'academicInfo': 'Academic Information',
        'leaveRequest': 'Leave Request',
        'profile': 'My Profile'
    };
    
    const subtitles = {
        'dashboard': 'Overview of your attendance and performance',
        'attendanceRecords': 'View and filter your attendance history',
        'academicInfo': 'Your academic details and performance',
        'leaveRequest': 'Apply for leave and track your requests',
        'profile': 'Manage your account information and security'
    };
    
    if (pageTitle && titles[tabName]) {
        pageTitle.textContent = titles[tabName];
    }
    
    if (sectionSubtitle) {
        if (tabName === 'dashboard') {
            const userName = localStorage.getItem('student_name') || 'Student';
            sectionSubtitle.textContent = `Welcome back, ${userName}`;
        } else {
            sectionSubtitle.textContent = subtitles[tabName] || '';
        }
    }
    
    // Load data based on section
    if (tabName === 'profile') {
        initProfileSection();
    } else if (tabName === 'dashboard') {
        loadDashboardData();
    } else if (tabName === 'attendanceRecords') {
        loadAttendanceRecords();
    } else if (tabName === 'leaveRequest') {
        loadLeaveRequests();
    }
    
    // Close mobile sidebar if open
    const mobileSidebar = document.getElementById('mobileSidebar');
    if (mobileSidebar && !mobileSidebar.classList.contains('hidden')) {
        toggleSidebar();
    }
}

function showSection(sectionId) {
    setActiveTab(sectionId);
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

function setupEventListeners() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
        const userDropdown = document.getElementById('userDropdown');
        const dropdownToggle = document.querySelector('[onclick="toggleUserDropdown()"]');
        
        if (userDropdown && !userDropdown.contains(event.target) && dropdownToggle && !dropdownToggle.contains(event.target)) {
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
        generateCalendar();
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

async function logout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }
    
    showLoading('Logging out...');
    
    try {
        // Simulate API call
        setTimeout(() => {
            // Clear local storage
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_id');
            localStorage.removeItem('user_role');
            localStorage.removeItem('institute_id');
            localStorage.removeItem('user_email');
            localStorage.removeItem('student_name');
            
            // Redirect to login page
            window.location.href = '/UI/register.html';
        }, 1000);
        
    } catch (error) {
        console.error('Error logging out:', error);
        // Still redirect even if logout API fails
        localStorage.clear();
        window.location.href = '/UI/register.html';
    }
}

// Helper functions for profile management
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

function getStrengthTextColor(score) {
    if (score >= 4) return 'text-green-400';
    if (score >= 3) return 'text-green-300';
    if (score >= 2) return 'text-yellow-400';
    return 'text-red-400';
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

function getCurrentMonthYear() {
    const now = new Date();
    return {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        monthName: now.toLocaleDateString('en-US', { month: 'long' })
    };
}

// Function to validate API response
function validateAttendanceData(data) {
    if (!data || !data.success || !data.data) {
        throw new Error('Invalid data format from API');
    }
    
    // Check if records exist
    if (!Array.isArray(data.data.records)) {
        throw new Error('Invalid records format');
    }
    
    return true;
}

// Function to handle API errors gracefully
async function handleApiError(apiCall) {
    try {
        return await apiCall();
    } catch (error) {
        console.error('API Error:', error);
        
        // Check if it's an authentication error
        if (error.status === 401) {
            showToast('Session expired. Please login again.', 'error');
            setTimeout(() => {
                logout();
            }, 2000);
            throw error;
        }
        
        // Check if it's a network error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showToast('Network error. Please check your connection.', 'error');
            throw error;
        }
        
        // For other errors, show generic message
        showToast('Failed to load data. Using fallback data.', 'warning');
        throw error;
    }
}

// Export utility functions globally for HTML onclick handlers
window.setActiveTab = setActiveTab;
window.toggleSidebar = toggleSidebar;
window.toggleUserDropdown = toggleUserDropdown;
window.toggleTheme = toggleTheme;
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.loadCurrentMonthTrend = loadCurrentMonthTrend;
window.loadLastMonthTrend = loadLastMonthTrend;
window.loadQuarterTrend = loadQuarterTrend;
window.filterAttendanceRecords = filterAttendanceRecords;
window.toggleLeaveDuration = toggleLeaveDuration;
window.openNewLeaveModal = openNewLeaveModal;
window.resetLeaveForm = resetLeaveForm;
window.submitLeaveRequest = submitLeaveRequest;
window.viewLeaveRequest = viewLeaveRequest;
window.cancelLeaveRequest = cancelLeaveRequest;
window.refreshDashboard = refreshDashboard;
window.logout = logout;
window.showSection = showSection;
window.togglePasswordVisibility = togglePasswordVisibility;
window.updateProfileName = updateProfileName;
window.updateEmail = updateEmail;
window.changePassword = changePassword;

// Initialize on window load
window.onload = function() {
    if (checkAuth()) {
        setActiveTab('dashboard');
    }
};
