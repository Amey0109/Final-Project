
    // ==================== GLOBAL VARIABLES ====================
    let currentUser = null;
    let charts = {};
    let currentTheme = 'dark';
    let authToken = localStorage.getItem('access_token');
    let currentInstituteId = localStorage.getItem('institute_id');
    let currentUserId = localStorage.getItem('user_id');
    let currentUserRole = localStorage.getItem('user_role');
    let currentUserEmail = localStorage.getItem('user_email');
    let currentUserName = localStorage.getItem('faculty_name');
    let filteredAttendanceData = [];
    let allAttendanceData = [];
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
    setupImageUploadListeners();
    
    // Load initial data
    loadDashboardData();
    loadClassesForFilters();
});
    
    // ==================== AUTHENTICATION ====================
    function checkAuth() {
        if (!authToken || !currentUserRole) {
            window.location.href = '/UI/register.html';
            return false;
        }
        
        // Check if user is faculty
        if (!['FACULTY', 'ADMIN', 'SUPER_ADMIN'].includes(currentUserRole)) {
            showToast('Access denied. Faculty privileges required.', 'error');
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
                        localStorage.setItem('faculty_name', data.data.full_name);
                        currentUserName = data.data.full_name;
                    } else if (data.data.email) {
                        // If no full name, use email username
                        const emailUsername = data.data.email.split('@')[0];
                        const displayName = emailUsername
                            .split(/[._]/)
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        localStorage.setItem('faculty_name', displayName);
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
        const storedName = localStorage.getItem('faculty_name');
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
        const userName = currentUserName || currentUserEmail?.split('@')[0] || 'Faculty';
        const displayName = userName.split(/[._]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        // Update the faculty name in the top-right corner
        const facultyNameElement = document.getElementById('facultyName');
        if (facultyNameElement) {
            facultyNameElement.textContent = displayName;
        }
        
        // Update the dropdown faculty name
        const dropdownFacultyName = document.getElementById('dropdownFacultyName');
        if (dropdownFacultyName) {
            dropdownFacultyName.textContent = displayName;
        }
        
        // Update the dropdown faculty email
        const dropdownFacultyEmail = document.getElementById('dropdownFacultyEmail');
        if (dropdownFacultyEmail) {
            dropdownFacultyEmail.textContent = currentUserEmail || 'Loading...';
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
            // Load faculty-specific dashboard stats
            const [statsResponse, facultyStatsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/dashboard-stats`, {
                    headers: getHeaders()
                }),
                fetch(`${API_BASE_URL}/faculty/dashboard/stats`, {
                    headers: getHeaders()
                })
            ]);
            
            if (statsResponse.status === 401 || facultyStatsResponse.status === 401) {
                logout();
                return;
            }
            
            if (!statsResponse.ok) {
                throw new Error(`API Error: ${statsResponse.status}`);
            }
            
            const generalStats = await statsResponse.json();
            
            if (facultyStatsResponse.ok) {
                const facultyStats = await facultyStatsResponse.json();
                updateFacultyDashboardUI(generalStats, facultyStats);
            } else {
                // Fallback to general stats only
                updateFacultyDashboardUI(generalStats, {
                    my_classes_count: 0,
                    my_students_count: 0,
                    assigned_classes: []
                });
            }
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
            showToast('Error loading dashboard data', 'error');
        } finally {
            hideLoading();
        }
    }
    
    // Update the loadDashboardData function
async function loadDashboardData() {
    if (!checkAuth()) return;
    
    showLoading('Loading dashboard data...');
    
    try {
        // Load faculty-specific dashboard stats
        const [statsResponse, facultyStatsResponse] = await Promise.all([
            fetch(`http://localhost:8000/api/faculty/stats`, {
                headers: getHeaders()
            }),
            fetch(`http://localhost:8000/api/faculty/students?limit=10`, {
                headers: getHeaders()
            })
        ]);
        
        if (statsResponse.status === 401 || facultyStatsResponse.status === 401) {
            logout();
            return;
        }
        
        if (statsResponse.ok) {
            const facultyStats = await statsResponse.json();
            updateFacultyDashboardUI(facultyStats);
            
            // Also update sidebar stats
            updateSidebarStats(facultyStats);
        } else {
            throw new Error(`Failed to load faculty stats: ${statsResponse.status}`);
        }
        
        // Load students for quick preview if needed
        if (facultyStatsResponse.ok) {
            const students = await facultyStatsResponse.json();
            updateStudentPreview(students);
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    } finally {
        hideLoading();
    }
}

function updateFacultyDashboardUI(facultyStats) {
    // Safely update dashboard stats
    const elements = {
        'totalStudentsCount': facultyStats.my_students?.toLocaleString() || '0',
        'todayAttendanceRate': (facultyStats.today_attendance_rate?.toFixed(1) || '0') + '%',
        'myClassesCount': facultyStats.my_classes?.toLocaleString() || '0',
        'weeklyAverageAttendance': (facultyStats.weekly_average_attendance?.toFixed(1) || '0') + '%',
        'todayPresentCount': facultyStats.today_present || '0',
        'todayTotalCount': facultyStats.today_total || '0',
        'todayAbsentCount': facultyStats.today_absent || '0'
    };
    
    // Update each element
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    // Update student status text
    const studentStatusText = document.getElementById('studentStatusText');
    if (studentStatusText) {
        studentStatusText.textContent = `${facultyStats.my_students || 0} Assigned Students`;
    }
    
    // Update attendance detail text
    const attendanceDetailText = document.getElementById('attendanceDetailText');
    if (attendanceDetailText) {
        attendanceDetailText.innerHTML = `
            <span id="todayPresentCount">${facultyStats.today_present || 0}</span> 
            Present / <span id="todayTotalCount">${facultyStats.today_total || 0}</span> 
            Total
        `;
    }
    
    // Update chart if weekly trend data exists
    if (facultyStats.weekly_trend && facultyStats.weekly_trend.length > 0) {
        updateAttendanceChart(facultyStats.weekly_trend);
    }
    
    // Update assigned classes list
    updateAssignedClassesList(facultyStats.assigned_classes || []);
}


function updateAssignedClassesList(assignedClasses) {
    const container = document.getElementById('assignedClassesList');
    if (!container) return;
    
    if (!assignedClasses || assignedClasses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-gray-400">
                <i class="fas fa-chalkboard-teacher text-2xl mb-2"></i>
                <p>No classes assigned yet</p>
                <p class="text-xs mt-1">Contact administrator to get assigned to classes</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    assignedClasses.forEach(cls => {
        const classDisplay = cls.stream 
            ? `${cls.class_name} - ${cls.stream}`
            : cls.class_name;
        
        html += `
            <div class="flex items-center justify-between p-3 rounded-lg glass-card mb-2">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <i class="fas fa-chalkboard text-white text-sm"></i>
                    </div>
                    <span class="font-medium">${classDisplay}</span>
                </div>
                <span class="text-xs text-gray-400">${formatDate(new Date(cls.created_at))}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

    
    function calculateWeeklyAverage(weeklyTrend) {
        if (!weeklyTrend || weeklyTrend.length === 0) return '0';
        
        const totalRate = weeklyTrend.reduce((sum, day) => sum + (day.attendance_rate || 0), 0);
        return (totalRate / weeklyTrend.length).toFixed(1);
    }
    
    function updateSidebarStats(stats) {
    // Update sidebar stats
    const sidebarElements = {
        'sidebarMyStudents': stats.my_students?.toLocaleString() || '0',
        'sidebarClassesCount': stats.my_classes?.toLocaleString() || '0',
        'sidebarTodayPresent': stats.today_present || '0',
        'sidebarTodayAbsent': stats.today_absent || '0',
        'sidebarStudentCount': stats.my_students?.toLocaleString() || '0',
        'mobileStudentCount': stats.my_students?.toLocaleString() || '0'
    };
    
    for (const [id, value] of Object.entries(sidebarElements)) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }
    
    // Update attendance badges
    const attendanceRate = stats.today_attendance_rate?.toFixed(1) || '0';
    const attendanceBadges = [
        'sidebarAttendanceBadge',
        'mobileAttendanceBadge'
    ];
    
    attendanceBadges.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = `Today: ${attendanceRate}%`;
    });
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

    function updateStudentPreview(students) {
    // If you have a student preview section on dashboard, update it here
    const studentPreviewContainer = document.getElementById('studentPreview');
    if (!studentPreviewContainer) return;
    
    if (!students || students.length === 0) {
        studentPreviewContainer.innerHTML = `
            <div class="text-center py-4 text-gray-400">
                <i class="fas fa-users text-2xl mb-2"></i>
                <p>No students assigned yet</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="space-y-2">';
    students.slice(0, 5).forEach(student => {
        html += `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <span class="text-white text-xs font-semibold">${getInitials(student.full_name)}</span>
                    </div>
                    <div>
                        <p class="text-sm font-medium">${student.full_name}</p>
                        <p class="text-xs text-gray-400">${student.roll_no} • ${student.standard || 'N/A'}</p>
                    </div>
                </div>
                <span class="text-xs px-2 py-1 rounded ${student.attendance_percentage >= 75 ? 'bg-green-900/30 text-green-400' : 
                    student.attendance_percentage >= 50 ? 'bg-yellow-900/30 text-yellow-400' : 
                    'bg-red-900/30 text-red-400'}">
                    ${student.attendance_percentage?.toFixed(1) || '0'}%
                </span>
            </div>
        `;
    });
    
    if (students.length > 5) {
        html += `
            <div class="text-center pt-2">
                <button onclick="setActiveTab('students')" class="text-sm text-indigo-400 hover:text-indigo-300">
                    View all ${students.length} students →
                </button>
            </div>
        `;
    }
    
    html += '</div>';
    studentPreviewContainer.innerHTML = html;
}

    // ==================== REPORTS SECTION FUNCTIONS ====================
    async function loadClassesForFilters() {
        try {
            const response = await fetch(`${API_BASE_URL}/classes`, {
                headers: getHeaders()
            });
            
            if (response.ok) {
                const classes = await response.json();
                populateClassFilters(classes);
            }
        } catch (error) {
            console.error('Error loading classes:', error);
        }
    }
    
    function populateClassFilters(classes) {
        // Populate class filter in students tab
        const studentClassFilter = document.getElementById('filterStudentClass');
        const reportClassFilter = document.getElementById('reportClassFilter');
        
        const filterElements = [studentClassFilter, reportClassFilter];
        
        filterElements.forEach(filter => {
            if (filter) {
                // Clear existing options except first one
                while (filter.options.length > 1) {
                    filter.remove(1);
                }
                
                // Add class options
                classes.forEach(className => {
                    const option = document.createElement('option');
                    option.value = className;
                    option.textContent = className;
                    filter.appendChild(option);
                });
            }
        });
    }
    
    function setToday() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('reportDateFilter').value = today;
    }
    
    async function generateReport() {
    const classFilter = document.getElementById('reportClassFilter').value;
    const streamFilter = document.getElementById('reportStreamFilter').value;
    const dateFilter = document.getElementById('reportDateFilter').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const format = document.getElementById('reportFormat').value;
    
    // Validate inputs
    if (!dateFilter && (!startDate || !endDate)) {
        showToast('Please select either a specific date or a date range', 'error');
        return;
    }
    
    showLoading('Generating report...');
    
    try {
        // Build query parameters
        const params = new URLSearchParams();
        if (classFilter) params.append('class_filter', classFilter);
        if (streamFilter) params.append('stream_filter', streamFilter);
        if (dateFilter) params.append('date_filter', dateFilter);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        params.append('format', format);
        params.append('include_summary', document.getElementById('includeSummary').checked);
        
        // IMPORTANT: Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
            // Generate report - remove Content-Type from headers
            const response = await fetch(`${API_BASE_URL}/reports/generate?${params.toString()}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                    // Don't set Content-Type - let the browser set it automatically
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                // Get filename from headers
                const contentDisposition = response.headers.get('content-disposition');
                let filename = 'attendance_report';
                
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                    }
                }
                
                // Determine file type from response
                const contentType = response.headers.get('content-type') || '';
                
                // Download the file
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                showToast('Report downloaded successfully!', 'success');
                
                // Refresh preview
                refreshPreview();
            } else {
                // Handle error response
                const contentType = response.headers.get('content-type') || '';
                
                if (contentType.includes('application/json')) {
                    // Try to parse as JSON
                    const error = await response.json();
                    throw new Error(error.detail || `Failed to generate report: ${response.status}`);
                } else {
                    // If not JSON, get text
                    const errorText = await response.text();
                    throw new Error(`Server error (${response.status}): ${errorText.substring(0, 100)}...`);
                }
            }
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            throw fetchError;
        }
        
    } catch (error) {
        console.error('Error generating report:', error);
        showToast(error.message || 'Error generating report', 'error');
    } finally {
        hideLoading();
    }
}
    
    function updateReportPreview(result) {
    const previewBody = document.getElementById('reportPreviewBody');
    const statsContainer = document.getElementById('reportStats');
    
    if (!previewBody) return;
    
    // Remove loading row
    const loadingRow = document.getElementById('reportLoadingRow');
    if (loadingRow) loadingRow.remove();
    
    if (!result.success || !result.data || result.data.length === 0) {
        previewBody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-gray-400">
                    <div class="flex flex-col items-center">
                        <i class="fas fa-search text-4xl mb-4"></i>
                        <p class="text-lg">No Data Found</p>
                        <p class="text-sm mt-1">Try adjusting your filter criteria</p>
                    </div>
                </td>
            </tr>
        `;
        statsContainer.classList.add('hidden');
        return;
    }
    
    // Populate preview table
    previewBody.innerHTML = '';
    result.data.forEach(record => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
        
        const attendancePct = record.attendance_percentage || 0;
        let statusClass = 'text-red-400';
        if (attendancePct >= 75) statusClass = 'text-green-400';
        else if (attendancePct >= 50) statusClass = 'text-yellow-400';
        
        row.innerHTML = `
            <td class="p-4 font-mono">${record.roll_no}</td>
            <td class="p-4">${record.student_name}</td>
            <td class="p-4">${record.class || 'N/A'}</td>
            <td class="p-4">${record.stream || 'N/A'}</td>
            <td class="p-4">${record.email || 'N/A'}</td>
            <td class="p-4">${record.phone || 'N/A'}</td>
            <td class="p-4 font-semibold ${statusClass}">
                ${attendancePct.toFixed(1)}%
            </td>
        `;
        
        previewBody.appendChild(row);
    });
    
    // Show statistics if available
    if (result.data.length > 0) {
        statsContainer.classList.remove('hidden');
        document.getElementById('reportTotalStudents').textContent = result.data.length;
        
        // Calculate average attendance
        const avgAttendance = result.data.reduce((sum, record) => 
            sum + (record.attendance_percentage || 0), 0) / result.data.length;
        document.getElementById('reportAvgAttendance').textContent = avgAttendance.toFixed(1) + '%';
        
        // Calculate present/absent counts (simplified)
        const presentCount = result.data.filter(r => (r.attendance_percentage || 0) > 0).length;
        const absentCount = result.data.length - presentCount;
        document.getElementById('reportPresentCount').textContent = presentCount;
        document.getElementById('reportAbsentCount').textContent = absentCount;
    }
}
    
    async function refreshPreview() {
    const classFilter = document.getElementById('reportClassFilter').value;
    const streamFilter = document.getElementById('reportStreamFilter').value;
    const dateFilter = document.getElementById('reportDateFilter').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    
    try {
        // Build query parameters
        const params = new URLSearchParams();
        if (classFilter) params.append('class_filter', classFilter);
        if (streamFilter) params.append('stream_filter', streamFilter);
        if (dateFilter) params.append('date_filter', dateFilter);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        
        const response = await fetch(`${API_BASE_URL}/reports/preview?${params.toString()}`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const result = await response.json();
            updateReportPreview(result);
        }
    } catch (error) {
        console.error('Error refreshing preview:', error);
    }
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
            
            // Debug: Log what data we're getting
            console.log('Students loaded:', allStudents.length);
            console.log('Sample student:', allStudents[0]);
            
            // Extract unique standards/classes from students
            const uniqueStandards = [...new Set(allStudents
                .map(s => s.standard)
                .filter(standard => standard && standard.trim() !== '')
            )].sort();
            
            console.log('Unique standards found:', uniqueStandards);
            
            // Populate the class filter dropdown
            populateClassFilterDropdown(uniqueStandards);
            
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

function populateClassFilterDropdown(classes) {
    const classFilter = document.getElementById('filterStudentClass');
    if (!classFilter) {
        console.error('filterStudentClass element not found!');
        return;
    }
    
    console.log('Populating class filter with:', classes);
    
    // Clear existing options except "All Classes"
    const defaultOption = classFilter.options[0];
    classFilter.innerHTML = '';
    if (defaultOption) {
        classFilter.appendChild(defaultOption.cloneNode(true));
    }
    
    // Add class options
    if (classes && classes.length > 0) {
        classes.forEach(standard => {
            if (standard && standard.trim() !== '') {
                const option = document.createElement('option');
                option.value = standard;
                option.textContent = standard;
                classFilter.appendChild(option);
                console.log(`Added option: ${standard}`);
            }
        });
    } else {
        console.log('No classes to add to filter');
        const noClassOption = document.createElement('option');
        noClassOption.value = '';
        noClassOption.textContent = 'No classes available';
        noClassOption.disabled = true;
        classFilter.appendChild(noClassOption);
    }
    
    console.log(`Class filter now has ${classFilter.options.length} options`);
}
    
    function updateStudentStats(students) {
        const total = students.length;
        const active = students.filter(s => s.status === 'ACTIVE' && s.is_active).length;
        const classes = [...new Set(students.map(s => s.standard).filter(Boolean))].length;
        const streams = [...new Set(students.map(s => s.stream).filter(Boolean))].length;
        
        document.getElementById('studentTotalCount').textContent = total;
        document.getElementById('studentActiveCount').textContent = active;
        document.getElementById('studentClassCount').textContent = classes;
        document.getElementById('studentStreamCount').textContent = streams;
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
                <td colspan="7" class="p-8 text-center text-gray-400">
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
            
            // Calculate attendance percentage (you'll need to implement this based on your data)
            // For now, we'll show a placeholder
            const attendancePercentage = "N/A"; // You should calculate this from actual attendance data
            
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
                <td class="p-4 font-semibold ${attendancePercentage >= 75 ? 'text-green-400' : 
                                               attendancePercentage >= 50 ? 'text-yellow-400' : 
                                               'text-red-400'}">
                    ${attendancePercentage}%
                </td>
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
            student.standard=== classFilter;
        
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
                allAttendanceData = await response.json();
                filteredAttendanceData = [...allAttendanceData];
                updateAttendanceDisplay(date);
                renderAttendanceTable();
                loadAttendanceStats(date);
                
                // Populate class filter with unique classes from data
                populateAttendanceClassFilter();
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
    
    if (filteredAttendanceData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-8 text-center text-gray-400">
                    <i class="fas fa-search text-3xl mb-3"></i>
                    <p class="text-lg">No attendance records found</p>
                    <p class="text-sm mt-1">Try adjusting your filters or select a different date</p>
                </td>
            </tr>
        `;
        return;
    }
    
    filteredAttendanceData.forEach(record => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800 hover:bg-gray-800/50';
        
        // Since attendance is AI-recorded, all records are considered "Present"
        const statusText = "Present";
        const statusColor = "badge-success";
        
        const recordedAt = record.created_at 
            ? formatTime(record.created_at)
            : 'N/A';
        
        row.innerHTML = `
            <td class="p-4 font-mono font-semibold">${record.roll_no}</td>
            <td class="p-4">${record.student_name}</td>
            <td class="p-4">${record.class_name || 'N/A'}</td>
            <td class="p-4">${record.stream || 'N/A'}</td>
            <td class="p-4">
                <span class="badge ${statusColor}">${statusText}</span>
            </td>
            <td class="p-4 text-gray-400 text-sm">${recordedAt}</td>
        `;
        
        tableBody.appendChild(row);
    });
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

    function populateAttendanceClassFilter() {
    const classFilter = document.getElementById('attendanceClassFilter');
    if (!classFilter) return;
    
    // Clear existing options except first one
    while (classFilter.options.length > 1) {
        classFilter.remove(1);
    }
    
    // Get unique classes from attendance data
    const uniqueClasses = [...new Set(allAttendanceData
        .map(item => item.class_name)
        .filter(Boolean))].sort();
    
    // Add class options
    uniqueClasses.forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        option.textContent = className;
        classFilter.appendChild(option);
    });
}
function updateFilteredAttendanceStats() {
    const container = document.getElementById('attendanceStatsContainer');
    if (!container || filteredAttendanceData.length === 0) return;
    
    const totalRecords = filteredAttendanceData.length;
    // For AI-recorded attendance, we need to get total students count
    // We'll calculate this from the API stats or use the filtered count as present
    const presentCount = totalRecords; // All AI records are present
    const totalStudents = allAttendanceData.length > 0 ? 
        // Try to get total from first record if available
        filteredAttendanceData[0]?.total_students || totalRecords : 
        totalRecords;
    
    const absentCount = Math.max(0, totalStudents - presentCount);
    const attendanceRate = totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;
    
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
            <p class="text-gray-400">Total Filtered</p>
            <p class="text-2xl font-bold text-blue-400 mt-1">${totalStudents}</p>
        </div>
    `;
}
function filterAttendanceTable() {
    const classFilter = document.getElementById('attendanceClassFilter')?.value || '';
    const streamFilter = document.getElementById('attendanceStreamFilter')?.value || '';
    const searchTerm = document.getElementById('attendanceSearch')?.value.toLowerCase() || '';
    
    filteredAttendanceData = allAttendanceData.filter(record => {
        // Filter by class
        if (classFilter && record.class_name !== classFilter) {
            return false;
        }
        
        // Filter by stream
        if (streamFilter && record.stream !== streamFilter) {
            return false;
        }
        
        
        // Filter by search term
        if (searchTerm) {
            const matchesName = record.student_name?.toLowerCase().includes(searchTerm);
            const matchesRollNo = record.roll_no?.toLowerCase().includes(searchTerm);
            if (!matchesName && !matchesRollNo) {
                return false;
            }
        }
        
        return true;
    });
    
    renderAttendanceTable();
    updateFilteredAttendanceStats();
}
   // ==================== Add students FUNCTIONS ====================

function setupImageUploadListeners() {
    const imageInput = document.getElementById('studentImage');
    if (imageInput) {
        imageInput.addEventListener('change', previewImage);
    }
}

function closeAddStudentModal() {
    const modal = document.getElementById('addStudentModal');
    if (modal) modal.classList.add('hidden');
    
    // Reset form and image
    document.getElementById('addStudentForm').reset();
    removeImage();
}

// Add drag and drop support
function setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('studentImage');
    
    if (!uploadArea) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    uploadArea.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        uploadArea.classList.add('border-indigo-500', 'bg-indigo-900/20');
    }
    
    function unhighlight() {
        uploadArea.classList.remove('border-indigo-500', 'bg-indigo-900/20');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
        }
    }
}

// Initialize drag and drop when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setupDragAndDrop();
});

async function loadAvailableClasses() {
    try {
        // First get faculty profile to know what classes they teach
        const response = await fetch('http://localhost:8000/api/faculty/stats', {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            const assignedClasses = data.assigned_classes || [];
            
            const classSelect = document.getElementById('studentClass');
            if (!classSelect) return;
            
            // Clear existing options except first one
            while (classSelect.options.length > 1) {
                classSelect.remove(1);
            }
            
            // Store class data for later use
            window.facultyClasses = assignedClasses;
            
            // Add assigned classes
            assignedClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.class_name;
                option.textContent = cls.class_name;
                classSelect.appendChild(option);
            });
            
            // If no classes assigned, disable the form
            if (assignedClasses.length === 0) {
                classSelect.innerHTML = '<option value="">No classes assigned</option>';
                classSelect.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error loading classes:', error);
        showToast('Error loading available classes', 'error');
    }
}

function updateStreamOptions() {
    const classSelect = document.getElementById('studentClass');
    const streamSelect = document.getElementById('studentStream');
    
    if (!classSelect || !streamSelect) return;
    
    const selectedClass = classSelect.value;
    
    // Check if selected class is 11 or 12
    const isSeniorClass = selectedClass === '11' || selectedClass === '12';
    
    // Update stream field requirements
    if (isSeniorClass) {
        streamSelect.required = true;
        streamSelect.parentElement.classList.add('required-field');
    } else {
        streamSelect.required = false;
        streamSelect.parentElement.classList.remove('required-field');
        // Optional: Clear stream selection for non-senior classes
        streamSelect.value = '';
    }
}


function previewImage(event) {
    const input = event.target;
    const previewContainer = document.getElementById('studentImagePreview');
    const previewImage = document.getElementById('previewImage');
    const uploadArea = document.getElementById('uploadArea');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showToast('File size must be less than 5MB', 'error');
            input.value = '';
            return;
        }
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            showToast('Please upload a valid image file (JPG, PNG, GIF)', 'error');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewContainer.classList.remove('hidden');
            uploadArea.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            fileName.textContent = file.name;
        }
        
        reader.readAsDataURL(file);
    }
}

function removeImage() {
    const input = document.getElementById('studentImage');
    const previewContainer = document.getElementById('studentImagePreview');
    const uploadArea = document.getElementById('uploadArea');
    const fileInfo = document.getElementById('fileInfo');
    
    input.value = '';
    previewContainer.classList.add('hidden');
    uploadArea.classList.remove('hidden');
    fileInfo.classList.add('hidden');
}

async function registerStudent(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData();
    
    // Get form values
    const fullName = document.getElementById('studentFullName').value.trim();
    const rollNo = document.getElementById('studentRollNo').value.trim();
    const standard = document.getElementById('studentClass').value;
    const email = document.getElementById('studentEmail').value.trim();
    const phone = document.getElementById('studentPhone').value.trim();
    const stream = document.getElementById('studentStream').value;
    const imageFile = document.getElementById('studentImage').files[0];
    
    // Validate required fields
    if (!fullName || !rollNo || !standard || !email || !phone) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Check if class is 11 or 12 and stream is required
    const isSeniorClass = standard === '11' || standard === '12';
    if (isSeniorClass && !stream) {
        showToast('Stream is required for classes 11 and 12', 'error');
        return;
    }
    
    // Validate email format
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    // Validate phone number format
    if (!validatePhoneNumber(phone)) {
        showToast('Please enter a valid phone number (10 digits starting with 6-9)', 'error');
        return;
    }
    
    // Check if roll number already exists in the same class
    if (await checkRollNumberExists(rollNo, standard)) {
        showToast(`Roll number ${rollNo} already exists in class ${standard}`, 'error');
        return;
    }
    
    // Add form data
    formData.append('full_name', fullName);
    formData.append('roll_no', rollNo);
    formData.append('standard', standard);
    formData.append('email', email);
    formData.append('phone', phone);
    if (stream) formData.append('stream', stream);
    if (imageFile) formData.append('image', imageFile);
    
    showLoading('Registering student...');
    
    try {
        // Use the new endpoint with image upload support
        const response = await fetch('http://localhost:8000/api/faculty/students/register', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
                // Don't set Content-Type - let browser set it with boundary
            },
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            
            showToast('Student registered successfully!', 'success');
            closeAddStudentModal();
            
            // Reset form
            document.getElementById('addStudentForm').reset();
            removeImage();
            
            // Refresh student list - stay in current section
            loadStudentsData();
            
            // Refresh dashboard stats (in background)
            loadDashboardData();
            
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to register student');
        }
    } catch (error) {
        console.error('Error registering student:', error);
        showToast(error.message || 'Error registering student', 'error');
    } finally {
        hideLoading();
    }
}


// Add these validation functions:

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePhoneNumber(phone) {
    if (!phone) return false;
    
    // Remove all non-digit characters for validation
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Check 1: Must be exactly 10 digits
    if (cleanPhone.length !== 10) {
        return false;
    }
    
    // Check 2: Must start with 6, 7, 8, or 9 (valid Indian mobile numbers)
    const re = /^[6-9]\d{9}$/;
    
    return re.test(cleanPhone);
}

async function checkRollNumberExists(rollNo, className) {
    try {
        // First, get all students from faculty
        const response = await fetch('http://localhost:8000/api/faculty/students?limit=1000', {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const students = await response.json();
            
            // Check if any student has the same roll number in the same class
            const existingStudent = students.find(student => 
                student.roll_no === rollNo && student.standard === className
            );
            
            return !!existingStudent; // Returns true if exists, false if not
        }
        
        return false; // If API fails, assume it doesn't exist (server will validate)
        
    } catch (error) {
        console.error('Error checking roll number:', error);
        return false; // If check fails, proceed (server will validate)
    }
}


function addPhoneNumberValidation() {
    const phoneInput = document.getElementById('studentPhone');
    if (phoneInput) {
        // Clear any existing event listeners by cloning and replacing
        const newPhoneInput = phoneInput.cloneNode(true);
        phoneInput.parentNode.replaceChild(newPhoneInput, phoneInput);
        
        // Add new event listeners
        newPhoneInput.addEventListener('input', function(e) {
            formatPhoneNumber(e.target);
            validatePhoneNumberInRealTime(e.target.value);
        });
        
        newPhoneInput.addEventListener('blur', function(e) {
            validatePhoneNumberInRealTime(e.target.value);
        });
        
        // Add focus event to show formatting
        newPhoneInput.addEventListener('focus', function() {
            if (!this.value) {
                this.placeholder = "e.g., 9876543210";
            }
        });
    }
}

function formatPhoneNumber(input) {
    // Remove all non-digit characters
    let value = input.value.replace(/\D/g, '');
    
    // Limit to 10 digits only
    value = value.substring(0, 10);
    
    // Format with spaces: XXX XXX XXXX
    if (value.length > 6) {
        value = value.replace(/(\d{3})(\d{3})(\d{0,4})/, '$1 $2 $3');
    } else if (value.length > 3) {
        value = value.replace(/(\d{3})(\d{0,3})/, '$1 $2');
    }
    
    input.value = value.trim();

}

function validatePhoneNumberInRealTime(phone) {
    const phoneInput = document.getElementById('studentPhone');
    if (!phoneInput) return;
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (phone === '') {
        phoneInput.classList.remove('border-green-500', 'border-red-500');
        showPhoneValidationMessage('neutral', 'Enter a 10-digit phone number');
        return;
    }
    
    let message = '';
    let isValid = false;
    
    // Check digit count first
    if (cleanPhone.length < 10) {
        message = `${cleanPhone.length}/10 digits entered`;
        showPhoneValidationMessage('error', message);
        phoneInput.classList.remove('border-green-500');
        phoneInput.classList.add('border-red-500');
        return;
    }
    
    if (cleanPhone.length > 10) {
        message = 'Too many digits (max 10)';
        showPhoneValidationMessage('error', message);
        phoneInput.classList.remove('border-green-500');
        phoneInput.classList.add('border-red-500');
        return;
    }
    
    // Now check format if we have exactly 10 digits
    if (cleanPhone.length === 10) {
        isValid = validatePhoneNumber(phone);
        
        if (isValid) {
            message = '✓ Valid phone number';
            showPhoneValidationMessage('success', message);
            phoneInput.classList.remove('border-red-500');
            phoneInput.classList.add('border-green-500');
        } else {
            message = '✗ Must start with 6, 7, 8, or 9';
            showPhoneValidationMessage('error', message);
            phoneInput.classList.remove('border-green-500');
            phoneInput.classList.add('border-red-500');
        }
    }
}
// Optional: Add real-time validation for roll number
function addRollNumberValidation() {
    const rollInput = document.getElementById('studentRollNo');
    const classSelect = document.getElementById('studentClass');
    
    if (rollInput) {
        // Debounced validation to avoid too many API calls
        let timeout;
        rollInput.addEventListener('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                const rollNo = rollInput.value.trim();
                const className = classSelect?.value;
                
                if (rollNo && className) {
                    const exists = await checkRollNumberExists(rollNo, className);
                    
                    if (exists) {
                        rollInput.classList.remove('border-green-500');
                        rollInput.classList.add('border-red-500');
                        showToast(`Roll number ${rollNo} already exists in class ${className}`, 'error', 2000);
                    } else {
                        rollInput.classList.remove('border-red-500');
                        rollInput.classList.add('border-green-500');
                    }
                }
            }, 500); // 500ms delay
        });
    }
}

// Optional: Add real-time validation for email
function addEmailValidation() {
    const emailInput = document.getElementById('studentEmail');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            const email = emailInput.value.trim();
            
            if (email === '') {
                emailInput.classList.remove('border-green-500', 'border-red-500');
                return;
            }
            
            if (validateEmail(email)) {
                emailInput.classList.remove('border-red-500');
                emailInput.classList.add('border-green-500');
            } else {
                emailInput.classList.remove('border-green-500');
                emailInput.classList.add('border-red-500');
            }
        });
    }
}

// Call these functions when showing the modal
function showAddStudentModal() {
    const modal = document.getElementById('addStudentModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Clear form
    document.getElementById('addStudentForm').reset();
    
    // Reset stream field to not required initially
    const streamSelect = document.getElementById('studentStream');
    if (streamSelect) {
        streamSelect.required = false;
        streamSelect.parentElement.classList.remove('required-field');
    }
    
    // Reset image preview
    removeImage();
    
    // Reset validation styles
    const inputs = ['studentFullName', 'studentRollNo', 'studentEmail', 'studentPhone'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.classList.remove('border-green-500', 'border-red-500');
        }
    });
    
    // Load available classes
    loadAvailableClasses();
    addPhoneNumberValidation();
}
// Update the loadStudentsData function to use faculty-specific endpoint
async function loadStudentsData() {
    showLoading('Loading student data...');
    
    try {
        // Use faculty-specific endpoint to get only assigned students
        const response = await fetch('http://localhost:8000/api/faculty/students?limit=1000', {
            headers: getHeaders()
        });
        
        if (response.ok) {
            allStudents = await response.json();
            updateStudentStats(allStudents);
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

// Update the existing renderStudentsTable function to include actions
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
            
            // Calculate attendance percentage
            const attendancePercentage = student.attendance_percentage || 0;
            const statusColor = attendancePercentage >= 75 ? 'text-green-400' : 
                              attendancePercentage >= 50 ? 'text-yellow-400' : 'text-red-400';
            
            row.innerHTML = `
                <td class="p-4 font-mono font-semibold">${student.roll_no}</td>
                <td class="p-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span class="text-white text-sm font-semibold">${getInitials(student.full_name)}</span>
                        </div>
                        <div>
                            <span class="block">${student.full_name}</span>
                            <span class="text-xs text-gray-400">${student.email || 'No email'}</span>
                        </div>
                    </div>
                </td>
                <td class="p-4">${student.standard || 'N/A'}</td>
                <td class="p-4">${student.stream || 'N/A'}</td>
                <td class="p-4 text-gray-400">${student.email || 'N/A'}</td>
                <td class="p-4 text-gray-400">${student.phone || 'N/A'}</td>
                <td class="p-4 font-semibold ${statusColor}">
                    ${attendancePercentage.toFixed(1)}%
                </td>
                <td class="p-4">
                    <div class="flex space-x-2">
                        <button onclick="showEditStudentModal(${student.student_id})" 
                                class="px-3 py-1 rounded-lg border border-blue-500 text-blue-400 hover:bg-blue-900/30 text-sm">
                            <i class="fas fa-edit mr-1"></i> Edit
                        </button>
                        <button onclick="showDeleteStudentModal(${student.student_id})" 
                                class="px-3 py-1 rounded-lg border border-red-500 text-red-400 hover:bg-red-900/30 text-sm">
                            <i class="fas fa-trash mr-1"></i> Delete
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    // Update table info and pagination
    document.getElementById('studentsTableInfo').textContent = 
        `Showing ${startIndex + 1}-${Math.min(endIndex, filteredStudents.length)} of ${filteredStudents.length} students`;
    
    updatePagination('studentsPagination', currentStudentPage, totalPages, 'changeStudentPage');
}

// Show Edit Student Modal
async function showEditStudentModal(studentId) {
    try {
        // Find the student data
        const student = allStudents.find(s => s.student_id === studentId);
        if (!student) {
            showToast('Student not found', 'error');
            return;
        }
        
        // Populate the edit form
        document.getElementById('editStudentId').value = student.student_id;
        document.getElementById('editStudentFullName').value = student.full_name || '';
        document.getElementById('editStudentRollNo').value = student.roll_no || '';
        document.getElementById('editStudentClass').value = student.standard || '';
        document.getElementById('editStudentStream').value = student.stream || '';
        document.getElementById('editStudentEmail').value = student.email || '';
        document.getElementById('editStudentPhone').value = student.phone || '';
        
        // Show the modal
        const modal = document.getElementById('editStudentModal');
        modal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading student data:', error);
        showToast('Error loading student data', 'error');
    }
}

// Close Edit Student Modal
function closeEditStudentModal() {
    const modal = document.getElementById('editStudentModal');
    modal.classList.add('hidden');
    document.getElementById('editStudentForm').reset();
}

// Update Student Function
async function updateStudent(event) {
    event.preventDefault();
    
    const studentId = document.getElementById('editStudentId').value;
    const fullName = document.getElementById('editStudentFullName').value.trim();
    const rollNo = document.getElementById('editStudentRollNo').value.trim();
    const standard = document.getElementById('editStudentClass').value.trim();
    const email = document.getElementById('editStudentEmail').value.trim();
    const phone = document.getElementById('editStudentPhone').value.trim();
    const stream = document.getElementById('editStudentStream').value.trim();
    
    // Validate required fields
    if (!fullName || !rollNo || !standard || !email || !phone) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Validate email format
    if (!validateEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    // Validate phone number format
    if (!validatePhoneNumber(phone)) {
        showToast('Please enter a valid phone number (10 digits starting with 6-9)', 'error');
        return;
    }
    
    showLoading('Updating student...');
    
    try {
        const response = await fetch(`http://localhost:8000/api/faculty/students/${studentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                full_name: fullName,
                roll_no: rollNo,
                standard: standard,
                email: email,
                phone: phone,
                stream: stream
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            showToast('Student updated successfully!', 'success');
            closeEditStudentModal();
            
            // Refresh student list - stay in current section
            loadStudentsData();
            
            // Refresh dashboard stats (in background)
            loadDashboardData();
            
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update student');
        }
    } catch (error) {
        console.error('Error updating student:', error);
        showToast(error.message || 'Error updating student', 'error');
    } finally {
        hideLoading();
    }
}

// Show Delete Student Modal
async function showDeleteStudentModal(studentId) {
    try {
        // Find the student data
        const student = allStudents.find(s => s.student_id === studentId);
        if (!student) {
            showToast('Student not found', 'error');
            return;
        }
        
        // Populate the delete modal
        document.getElementById('deleteStudentName').textContent = student.full_name;
        document.getElementById('deleteStudentDetails').textContent = 
            `Roll No: ${student.roll_no} | Class: ${student.standard}${student.stream ? ` | Stream: ${student.stream}` : ''}`;
        
        // Store the student ID for deletion
        window.currentDeleteStudentId = studentId;
        
        // Reset confirmation checkbox
        document.getElementById('confirmDelete').checked = false;
        document.getElementById('deleteStudentButton').disabled = true;
        
        // Add event listener for checkbox
        const confirmCheckbox = document.getElementById('confirmDelete');
        const deleteButton = document.getElementById('deleteStudentButton');
        
        confirmCheckbox.onchange = function() {
            deleteButton.disabled = !this.checked;
        };
        
        // Show the modal
        const modal = document.getElementById('deleteStudentModal');
        modal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading student data:', error);
        showToast('Error loading student data', 'error');
    }
}

// Close Delete Student Modal
function closeDeleteStudentModal() {
    const modal = document.getElementById('deleteStudentModal');
    modal.classList.add('hidden');
    window.currentDeleteStudentId = null;
    document.getElementById('confirmDelete').checked = false;
    document.getElementById('deleteStudentButton').disabled = true;
}

// Delete Student Function
async function deleteStudent() {
    if (!window.currentDeleteStudentId) {
        showToast('No student selected for deletion', 'error');
        return;
    }
    
    if (!document.getElementById('confirmDelete').checked) {
        showToast('Please confirm deletion by checking the box', 'error');
        return;
    }
    
    showLoading('Deleting student...');
    
    try {
        const response = await fetch(`http://localhost:8000/api/faculty/students/${window.currentDeleteStudentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            
            showToast('Student deleted successfully!', 'success');
            closeDeleteStudentModal();
            
            // Refresh student list - stay in current section
            loadStudentsData();
            
            // Refresh dashboard stats (in background)
            loadDashboardData();
            
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete student');
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        showToast(error.message || 'Error deleting student', 'error');
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
        'students': 'My Students',
        'attendance': 'Attendance Management',
        'reports': 'Attendance Reports',
        'profile': 'My Profile'
    };
    
    if (pageTitle && titles[sectionId]) {
        pageTitle.textContent = titles[sectionId];
    }
    
    if (sectionSubtitle) {
        if (sectionId === 'dashboard') {
            const userName = localStorage.getItem('faculty_name') || 'Faculty';
            sectionSubtitle.textContent = `Welcome back, ${userName}`;
        } else {
            const subtitles = {
                'students': 'View and manage students assigned to you',
                'attendance': 'Track and manage daily attendance records',
                'reports': 'Generate detailed attendance reports with filters',
                'profile': 'Manage your account information and security'
            };
            sectionSubtitle.textContent = subtitles[sectionId] || '';
        }
    }
    
    // Load data based on section
    if (sectionId === 'profile') {
        loadProfileData();
    } else if (sectionId === 'dashboard') {
        loadDashboardData();
    } else if (sectionId === 'students') {
        loadStudentsData();
    } else if (sectionId === 'attendance') {
        loadTodaysAttendance();
    } else if (sectionId === 'reports') {
        loadClassesForFilters();
    }
    
    // Close mobile sidebar if open
    const mobileSidebar = document.getElementById('mobileSidebar');
    if (mobileSidebar && !mobileSidebar.classList.contains('hidden')) {
        toggleSidebar();
    }
    
    // Close user dropdown if open
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown && !userDropdown.classList.contains('hidden')) {
        userDropdown.classList.add('hidden');
    }
}

async function loadProfileData() {
    showLoading('Loading profile data...');
    
    try {
        // Load user profile
        const response = await fetch('http://localhost:8000/users/profile', {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const profile = data.data;
                
                // Update profile fields
                document.getElementById('profileName').value = profile.full_name || '';
                document.getElementById('profileEmail').value = profile.email || '';
                document.getElementById('profileRole').textContent = profile.role === 'FACULTY' ? 'Faculty Member' : profile.role;
                document.getElementById('profileCreatedAt').textContent = profile.created_at ? formatDate(new Date(profile.created_at)) : 'N/A';
                document.getElementById('profileDisplayName').textContent = profile.full_name || profile.email || 'Faculty';
                document.getElementById('profileDisplayEmail').textContent = profile.email || 'N/A';
                document.getElementById('profileRoleBadge').textContent = profile.role === 'FACULTY' ? 'Faculty' : profile.role;
                
                // Update last login
                if (profile.last_login) {
                    document.getElementById('profileLastLogin').textContent = formatDateTime(new Date(profile.last_login));
                }
                
                // Update theme preference
                const currentTheme = localStorage.getItem('theme') || 'dark';
                document.getElementById('profileTheme').textContent = currentTheme === 'dark' ? 'Dark' : 'Light';
                
                showToast('Profile loaded successfully', 'success');
            } else {
                showToast('Failed to load profile', 'error');
            }
        } else {
            throw new Error('Failed to load profile');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Error loading profile data', 'error');
    } finally {
        hideLoading();
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

function initializePasswordStrengthChecker() {
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function(e) {
            updatePasswordStrength(e.target.value);
            checkPasswordMatch();
        });
        
        // Trigger initial check
        updatePasswordStrength(newPasswordInput.value);
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    }
    
    // Also add event listeners for password visibility toggle buttons
    const passwordFields = ['currentPassword', 'newPassword', 'confirmPassword'];
    passwordFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const toggleBtn = field?.nextElementSibling;
        if (field && toggleBtn && toggleBtn.tagName === 'BUTTON') {
            toggleBtn.addEventListener('click', function() {
                togglePasswordVisibility(fieldId);
            });
        }
    });
}

function updatePasswordStrength(password) {
    const strengthBar = document.getElementById('passwordStrength');
    const strengthText = document.getElementById('passwordStrengthText');
    const checks = {
        length: document.getElementById('lengthCheck'),
        uppercase: document.getElementById('uppercaseCheck'),
        lowercase: document.getElementById('lowercaseCheck'),
        number: document.getElementById('numberCheck'),
        special: document.getElementById('specialCheck')
    };
    
    // Password criteria
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= minLength;
    
    // Update check icons
    updateCheckIcon(checks.length, isLongEnough);
    updateCheckIcon(checks.uppercase, hasUpperCase);
    // updateCheckIcon(checks.lowercase, hasLowerCase); 
    updateCheckIcon(checks.number, hasNumbers);
    updateCheckIcon(checks.special, hasSpecial);
    
    // Calculate strength score
    let score = 0;
    if (isLongEnough) score++;
    if (hasUpperCase) score++;
    if (hasLowerCase) score++; // Add this if you want lowercase requirement
    if (hasNumbers) score++;
    if (hasSpecial) score++;
    
    // Determine strength level
    let strength = 'Weak';
    let width = 0;
    let color = '';
    
    if (score === 0) {
        strength = 'Weak';
        width = 0;
        color = 'bg-red-500';
    } else if (score === 1) {
        strength = 'Very Weak';
        width = 25;
        color = 'bg-red-500';
    } else if (score === 2) {
        strength = 'Weak';
        width = 50;
        color = 'bg-red-400';
    } else if (score === 3) {
        strength = 'Medium';
        width = 75;
        color = 'bg-yellow-500';
    } else if (score >= 4) {
        strength = 'Strong';
        width = 100;
        color = 'bg-green-500';
    }
    
    // Update strength bar
    if (strengthBar) {
        // Reset classes
        strengthBar.className = 'h-2 flex-1 rounded-full transition-all duration-300';
        // Add color class
        strengthBar.classList.add(color.replace('bg-', 'bg-'));
        // Set width
        strengthBar.style.width = `${width}%`;
    }
    
    // Update strength text
    if (strengthText) {
        strengthText.textContent = strength;
        
        // Set text color based on strength
        const textColors = {
            'Weak': 'text-red-400',
            'Very Weak': 'text-red-500',
            'Medium': 'text-yellow-400',
            'Strong': 'text-green-400'
        };
        
        // Reset classes
        strengthText.className = 'text-xs';
        // Add appropriate color class
        if (textColors[strength]) {
            strengthText.classList.add(textColors[strength]);
        } else {
            strengthText.classList.add('text-gray-400');
        }
    }
    
    return score >= 3; // Returns true if password is medium or strong
}

// Helper function to update check icons
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

// Initialize the password strength checker when profile section is shown
document.addEventListener('DOMContentLoaded', function() {
    // Listen for when profile section becomes visible
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const profileSection = document.getElementById('profileSection');
                if (profileSection && !profileSection.classList.contains('hidden')) {
                    initializePasswordStrengthChecker();
                }
            }
        });
    });
    
    // Start observing the profile section
    const profileSection = document.getElementById('profileSection');
    if (profileSection) {
        observer.observe(profileSection, { attributes: true });
    }
    
    // Also initialize immediately if profile section is already visible
    if (profileSection && !profileSection.classList.contains('hidden')) {
        initializePasswordStrengthChecker();
    }
});
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
        document.getElementById('dashboardTab')?.classList.add('hidden');
        document.getElementById('studentsTab')?.classList.add('hidden');
        document.getElementById('attendanceTab')?.classList.add('hidden');
        document.getElementById('reportsTab')?.classList.add('hidden');
        document.getElementById('profileSection')?.classList.add('hidden');
        
        // Remove active class from all nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(`${tabName}Tab`)?.classList.remove('hidden');
        if (tabName === 'profile') {
            document.getElementById('profileSection')?.classList.remove('hidden');
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
                sectionSubtitle.textContent = `Welcome back, ${currentUserName || 'Faculty'}`;
                loadDashboardData();
                break;
            case 'students':
                pageTitle.textContent = 'My Students';
                sectionSubtitle.textContent = 'View and manage students assigned to you';
                loadStudentsData();
                break;
            case 'attendance':
                pageTitle.textContent = 'Attendance Management';
                sectionSubtitle.textContent = 'Track and manage daily attendance records';
                loadTodaysAttendance();
                break;
            case 'reports':
                pageTitle.textContent = 'Attendance Reports';
                sectionSubtitle.textContent = 'Generate detailed attendance reports with filters';
                break;
            case 'profile':
                pageTitle.textContent = 'My Profile';
                sectionSubtitle.textContent = 'Manage your account information and security';
                loadProfileData();
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
            localStorage.removeItem('faculty_name');
            
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
    
    // Export utility functions globally for HTML onclick handlers
    // Remove mark attendance related functions from window exports
    window.setActiveTab = setActiveTab;
    window.toggleSidebar = toggleSidebar;
    window.toggleUserDropdown = toggleUserDropdown;
    window.toggleTheme = toggleTheme;
    window.loadTodaysAttendance = loadTodaysAttendance;
    window.loadYesterdaysAttendance = loadYesterdaysAttendance;
    window.loadAttendanceForDate = loadAttendanceForDate;
    window.filterAttendanceTable = filterAttendanceTable;
    window.generateReport = generateReport;
    window.refreshPreview = refreshPreview;
    window.refreshDashboard = refreshDashboard;
    window.logout = logout;
    window.filterStudentTable = filterStudentTable;
    window.setToday = setToday;
    window.showAddStudentModal = showAddStudentModal;
    window.closeAddStudentModal = closeAddStudentModal;
    window.showEditStudentModal = showEditStudentModal;
    window.closeEditStudentModal = closeEditStudentModal;
    window.showDeleteStudentModal = showDeleteStudentModal;
    window.closeDeleteStudentModal = closeDeleteStudentModal;
    window.updateStudent = updateStudent;
    window.deleteStudent = deleteStudent;
