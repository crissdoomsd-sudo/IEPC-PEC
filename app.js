// Firebase Modular SDK v9+
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    onValue, 
    push, 
    update, 
    remove,
    query,
    orderByChild,
    get
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: 'AIzaSyAhsn87Ymkv7MrOD-5aQiDCCzFCs-V8oZI',
    authDomain: 'iepc-pec.firebaseapp.com',
    databaseURL: 'https://iepc-pec-default-rtdb.firebaseio.com',
    projectId: 'iepc-pec',
    storageBucket: 'iepc-pec.firebasestorage.app',
    messagingSenderId: '962879217189',
    appId: '1:962879217189:web:5a4e27ed8ab58838d6e9cc',
    measurementId: 'G-RXCC1PXD7J'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Global State
let currentUser = null;
let studentsData = [];
let teachersData = [];
let attendanceData = {};
let todayAttendance = {};
let charts = {};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initDateTime();
    initAuth();
    initListeners();
    initForms();
    generateHeatmap();
    
    // Load initial data
    loadStudents();
    loadTeachers();
    loadTodayAttendance();
    loadLicenses();
});

// Date & Time
function initDateTime() {
    const updateDateTime = () => {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('es-ES', options);
        document.getElementById('currentTime').textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('listaDate').textContent = `Fecha: ${now.toLocaleDateString('es-ES')}`;
    };
    updateDateTime();
    setInterval(updateDateTime, 60000);
}

// Auth State
function initAuth() {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateAuthUI();
    });
}

function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const userInfo = document.getElementById('userInfo');
    
    if (currentUser) {
        authBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Cerrar Sesión</span>';
        authBtn.onclick = logout;
        authBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        authBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        
        userInfo.classList.remove('hidden');
        document.getElementById('userName').textContent = currentUser.displayName || 'Usuario';
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userAvatar').textContent = (currentUser.displayName || 'U')[0].toUpperCase();
    } else {
        authBtn.innerHTML = '<i class="fas fa-lock"></i> <span>Iniciar Sesión</span>';
        authBtn.onclick = toggleLogin;
        authBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        authBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        
        userInfo.classList.add('hidden');
    }
}

function toggleLogin() {
    document.getElementById('loginModal').classList.remove('hidden');
}

function closeLogin() {
    document.getElementById('loginModal').classList.add('hidden');
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeLogin();
        showToast('Sesión iniciada correctamente');
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
});

function logout() {
    signOut(auth).then(() => {
        showToast('Sesión cerrada');
    });
}

// Navigation
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section-content').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show target section
    document.getElementById(sectionId).classList.remove('hidden');
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.section === sectionId) {
            btn.classList.add('active');
        }
    });
    
    // Close sidebar on mobile
    if (window.innerWidth < 1024) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
    }
    
    // Refresh data for specific sections
    if (sectionId === 'lista') {
        loadAttendanceTable();
    } else if (sectionId === 'bitacora') {
        loadBitacora();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('-translate-x-full');
}

// Firebase Listeners
function initListeners() {
    // Students listener
    const studentsRef = ref(db, 'students');
    onValue(studentsRef, (snapshot) => {
        const data = snapshot.val();
        studentsData = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        updateDashboard();
        filterStudents();
        loadAttendanceTable();
    });
    
    // Teachers listener
    const teachersRef = ref(db, 'teachers');
    onValue(teachersRef, (snapshot) => {
        const data = snapshot.val();
        teachersData = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        renderTeachers();
    });
    
    // Today's attendance listener
    const today = new Date().toISOString().split('T')[0];
    const attendanceRef = ref(db, `attendance/${today}`);
    onValue(attendanceRef, (snapshot) => {
        todayAttendance = snapshot.val() || {};
        updateDashboard();
        filterStudents();
    });
}

// Dashboard Functions
function updateDashboard() {
    const total = studentsData.length;
    const today = new Date().toISOString().split('T')[0];
    const attendance = todayAttendance || {};
    
    let asistencias = 0, ausentes = 0, atrasos = 0, licencias = 0;
    
    studentsData.forEach(student => {
        const status = attendance[student.id]?.status || 'pendiente';
        if (status === 'asistio') asistencias++;
        else if (status === 'ausente') ausentes++;
        else if (status === 'atraso') atrasos++;
        else if (status === 'licencia') licencias++;
    });
    
    // Update counters with animation
    animateCounter('totalStudents', total);
    animateCounter('todayAttendance', asistencias);
    animateCounter('todayAbsents', ausentes);
    animateCounter('todayLates', atrasos);
    
    // Update percentages
    const totalChecked = asistencias + ausentes + atrasos + licencias;
    document.getElementById('attendancePercent').textContent = total > 0 ? Math.round((asistencias / total) * 100) + '%' : '0%';
    document.getElementById('absentPercent').textContent = total > 0 ? Math.round((ausentes / total) * 100) + '%' : '0%';
    document.getElementById('latePercent').textContent = total > 0 ? Math.round((atrasos / total) * 100) + '%' : '0%';
    document.getElementById('studentsTrend').textContent = '+0%'; // Would need historical data
    
    // Update charts
    updateCharts(asistencias, ausentes, atrasos, licencias, total);
}

function animateCounter(id, target) {
    const element = document.getElementById(id);
    const current = parseInt(element.textContent) || 0;
    const increment = target > current ? 1 : -1;
    
    if (current !== target) {
        const timer = setInterval(() => {
            const newValue = parseInt(element.textContent) + increment;
            element.textContent = newValue;
            if (newValue === target) clearInterval(timer);
        }, 20);
    }
}

function updateCharts(asistencias, ausentes, atrasos, licencias, total) {
    // Mini sparkline charts
    const sparklineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } }
    };
    
    // Generate dummy trend data (in real app, fetch historical)
    const trendData = Array.from({length: 7}, () => Math.floor(Math.random() * total));
    
    // Destroy existing charts
    Object.values(charts).forEach(chart => chart?.destroy?.());
    
    // Students Chart
    const ctxStudents = document.getElementById('chartStudents').getContext('2d');
    charts.students = new Chart(ctxStudents, {
        type: 'line',
        data: {
            labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
            datasets: [{
                data: trendData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true
            }]
        },
        options: sparklineOptions
    });
    
    // Attendance Chart
    const ctxAttendance = document.getElementById('chartAttendance').getContext('2d');
    charts.attendance = new Chart(ctxAttendance, {
        type: 'line',
        data: {
            labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
            datasets: [{
                data: trendData.map(v => Math.floor(v * 0.9)),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true
            }]
        },
        options: sparklineOptions
    });
    
    // Absents Chart
    const ctxAbsents = document.getElementById('chartAbsents').getContext('2d');
    charts.absents = new Chart(ctxAbsents, {
        type: 'line',
        data: {
            labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
            datasets: [{
                data: trendData.map(v => Math.floor(v * 0.05)),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true
            }]
        },
        options: sparklineOptions
    });
    
    // Lates Chart
    const ctxLates = document.getElementById('chartLates').getContext('2d');
    charts.lates = new Chart(ctxLates, {
        type: 'line',
        data: {
            labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
            datasets: [{
                data: trendData.map(v => Math.floor(v * 0.03)),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                fill: true
            }]
        },
        options: sparklineOptions
    });
    
    // Pie Chart
    const ctxPie = document.getElementById('pieChart').getContext('2d');
    if (charts.pie) charts.pie.destroy();
    charts.pie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Asistió', 'Ausente', 'Atraso', 'Licencia'],
            datasets: [{
                data: [asistencias, ausentes, atrasos, licencias],
                backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#6366f1'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Heatmap Generation
function generateHeatmap() {
    const heatmap = document.getElementById('heatmap');
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay();
    
    let html = '';
    
    // Day headers
    const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    dayNames.forEach(day => {
        html += `<div class="text-center font-semibold text-gray-400 py-2">${day}</div>`;
    });
    
    // Empty cells for offset
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="heatmap-cell heatmap-empty"></div>`;
    }
    
    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const attendance = Math.random(); // Simulated - in real app, fetch from DB
        let className = 'heatmap-empty';
        if (attendance > 0.8) className = 'heatmap-full';
        else if (attendance > 0.6) className = 'heatmap-high';
        else if (attendance > 0.3) className = 'heatmap-medium';
        else if (attendance > 0) className = 'heatmap-low';
        
        const isToday = day === new Date().getDate();
        const borderClass = isToday ? 'ring-2 ring-blue-500 ring-offset-1' : '';
        
        html += `<div class="heatmap-cell ${className} ${borderClass}" title="Día ${day}: ${Math.round(attendance * 100)}% asistencia">${day}</div>`;
    }
    
    heatmap.innerHTML = html;
}

// Teachers Management
function renderTeachers() {
    const grid = document.getElementById('teachersGrid');
    
    if (teachersData.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400">No hay maestros registrados</div>';
        return;
    }
    
    grid.innerHTML = teachersData.map(teacher => `
        <div class="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition cursor-pointer" onclick="showTeacherProfile('${teacher.id}')">
            <div class="flex items-start justify-between mb-4">
                <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
                    ${teacher.name[0]}${teacher.lastName[0]}
                </div>
                <span class="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                    ${teacher.specialty || 'General'}
                </span>
            </div>
            <h3 class="font-bold text-lg text-gray-800">${teacher.name} ${teacher.lastName}</h3>
            <p class="text-gray-500 text-sm mb-3">${teacher.phone || 'Sin teléfono'}</p>
            <div class="flex items-center gap-2 text-sm text-gray-600">
                <i class="fas fa-envelope text-gray-400"></i>
                <span class="truncate">${teacher.email || 'No disponible'}</span>
            </div>
        </div>
    `).join('');
}

function showTeacherProfile(teacherId) {
    const teacher = teachersData.find(t => t.id === teacherId);
    if (!teacher) return;
    
    const content = document.getElementById('teacherModalContent');
    content.innerHTML = `
        <div class="flex items-center gap-4 mb-6">
            <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
                ${teacher.name[0]}${teacher.lastName[0]}
            </div>
            <div>
                <h4 class="text-xl font-bold">${teacher.name} ${teacher.lastName}</h4>
                <p class="text-gray-500">${teacher.specialty || 'Docente'}</p>
            </div>
        </div>
        <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-gray-100">
                <span class="text-gray-500">Teléfono</span>
                <span class="font-medium">${teacher.phone || 'N/A'}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-gray-100">
                <span class="text-gray-500">Correo</span>
                <span class="font-medium">${teacher.email || 'N/A'}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-gray-100">
                <span class="text-gray-500">Fecha de registro</span>
                <span class="font-medium">${teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
        </div>
        <div class="mt-6 flex gap-2">
            <button onclick="closeTeacherModal()" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg transition">Cerrar</button>
            <button onclick="deleteTeacher('${teacherId}')" class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg transition">Eliminar</button>
        </div>
    `;
    
    document.getElementById('teacherModal').classList.remove('hidden');
}

function closeTeacherModal() {
    document.getElementById('teacherModal').classList.add('hidden');
}

function openTeacherForm() {
    showSection('bitacora');
    document.getElementById('teacherName').focus();
}

function deleteTeacher(teacherId) {
    if (!confirm('¿Está seguro de eliminar este maestro?')) return;
    remove(ref(db, `teachers/${teacherId}`)).then(() => {
        showToast('Maestro eliminado');
        closeTeacherModal();
    });
}

// Students Management
function loadStudents() {
    // Handled by listener
}

function filterStudents() {
    const search = document.getElementById('studentSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const gradeFilter = document.getElementById('gradeFilter').value;
    
    let filtered = studentsData.filter(student => {
        const fullName = `${student.name} ${student.lastName}`.toLowerCase();
        const matchSearch = fullName.includes(search) || (student.ci && student.ci.includes(search));
        
        const today = new Date().toISOString().split('T')[0];
        const status = todayAttendance[student.id]?.status || 'pendiente';
        const matchStatus = !statusFilter || status === statusFilter;
        
        const matchGrade = !gradeFilter || student.grade === gradeFilter;
        
        return matchSearch && matchStatus && matchGrade;
    });
    
    renderStudentsTable(filtered);
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    document.getElementById('studentsCount').textContent = `${students.length} estudiantes`;
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">No se encontraron estudiantes</td></tr>';
        return;
    }
    
    tbody.innerHTML = students.map((student, index) => {
        const today = new Date().toISOString().split('T')[0];
        const attendance = todayAttendance[student.id] || {};
        const status = attendance.status || 'pendiente';
        const statusClass = {
            'asistio': 'status-asistio',
            'ausente': 'status-ausente',
            'atraso': 'status-atraso',
            'licencia': 'status-licencia',
            'pendiente': 'bg-gray-100 text-gray-600'
        }[status] || 'bg-gray-100 text-gray-600';
        
        const statusText = {
            'asistio': 'Asistió',
            'ausente': 'Ausente',
            'atraso': 'Atraso',
            'licencia': 'Licencia',
            'pendiente': 'Pendiente'
        }[status] || 'Pendiente';
        
        return `
            <tr class="hover:bg-gray-50 transition">
                <td class="px-6 py-4 text-sm text-gray-500">${index + 1}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                            ${student.name[0]}${student.lastName[0]}
                        </div>
                        <div>
                            <p class="font-medium text-gray-900">${student.name} ${student.lastName}</p>
                            <p class="text-xs text-gray-500">CI: ${student.ci || 'N/A'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">${student.tutor || 'N/A'}</td>
                <td class="px-6 py-4 text-sm text-gray-600">${student.phone || 'N/A'}</td>
                <td class="px-6 py-4">
                    <span class="status-badge ${statusClass}">
                        <i class="fas fa-${status === 'asistio' ? 'check' : status === 'ausente' ? 'times' : status === 'atraso' ? 'clock' : 'circle'} text-xs"></i>
                        ${statusText}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">${attendance.observations || '-'}</td>
                <td class="px-6 py-4">
                    <button onclick="editStudent('${student.id}')" class="text-blue-600 hover:text-blue-800 mr-2">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteStudent('${student.id}')" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function exportStudentsCSV() {
    const headers = ['#', 'Nombre', 'Apellido', 'CI', 'Celular', 'Tutor', 'Domicilio', 'Curso', 'Estado Hoy', 'Observaciones'];
    const rows = studentsData.map((s, i) => {
        const att = todayAttendance[s.id] || {};
        return [
            i + 1,
            s.name,
            s.lastName,
            s.ci || '',
            s.phone || '',
            s.tutor || '',
            s.address || '',
            s.grade || '',
            att.status || 'pendiente',
            att.observations || ''
        ];
    });
    
    downloadCSV([headers, ...rows], 'estudiantes.csv');
}

function printStudents() {
    window.print();
}

function editStudent(studentId) {
    const student = studentsData.find(s => s.id === studentId);
    if (!student) return;
    
    document.getElementById('studentName').value = student.name;
    document.getElementById('studentLastName').value = student.lastName;
    document.getElementById('studentCI').value = student.ci || '';
    document.getElementById('studentPhone').value = student.phone || '';
    document.getElementById('studentTutor').value = student.tutor || '';
    document.getElementById('studentAddress').value = student.address || '';
    document.getElementById('studentGrade').value = student.grade || '';
    
    showSection('bitacora');
    showToast('Modo edición activado. Actualice los datos y guarde.');
}

function deleteStudent(studentId) {
    if (!confirm('¿Eliminar este estudiante?')) return;
    remove(ref(db, `students/${studentId}`)).then(() => showToast('Estudiante eliminado'));
}

// Attendance (Toma de Lista)
function loadAttendanceTable() {
    const tbody = document.getElementById('attendanceTableBody');
    const today = new Date().toISOString().split('T')[0];
    
    if (studentsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">No hay estudiantes registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = studentsData.map((student, index) => {
        const att = todayAttendance[student.id] || {};
        const status = att.status || 'pendiente';
        
        return `
            <tr class="hover:bg-gray-50 transition" data-student-id="${student.id}">
                <td class="px-6 py-4 text-sm text-gray-500">${index + 1}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                            ${student.name[0]}${student.lastName[0]}
                        </div>
                        <div>
                            <p class="font-medium text-gray-900">${student.name} ${student.lastName}</p>
                            <p class="text-xs text-gray-500">${student.grade || ''}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <input type="radio" name="att_${student.id}" value="asistio" class="attendance-radio" 
                        ${status === 'asistio' ? 'checked' : ''} onchange="updateAttendance('${student.id}', 'asistio')">
                </td>
                <td class="px-6 py-4 text-center">
                    <input type="radio" name="att_${student.id}" value="ausente" class="attendance-radio" 
                        ${status === 'ausente' ? 'checked' : ''} onchange="updateAttendance('${student.id}', 'ausente')">
                </td>
                <td class="px-6 py-4 text-center">
                    <input type="radio" name="att_${student.id}" value="atraso" class="attendance-radio" 
                        ${status === 'atraso' ? 'checked' : ''} onchange="updateAttendance('${student.id}', 'atraso')">
                </td>
                <td class="px-6 py-4">
                    <select class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        onchange="updateIncidents('${student.id}', this.value)">
                        <option value="">Sin incidencias</option>
                        <option value="indisciplina" ${att.incidents?.includes('indisciplina') ? 'selected' : ''}>Indisciplina</option>
                        <option value="tareas" ${att.incidents?.includes('tareas') ? 'selected' : ''}>No trajo tareas</option>
                        <option value="uniforme" ${att.incidents?.includes('uniforme') ? 'selected' : ''}>Sin uniforme</option>
                        <option value="material" ${att.incidents?.includes('material') ? 'selected' : ''}>Sin material</option>
                        <option value="pelea" ${att.incidents?.includes('pelea') ? 'selected' : ''}>Pelea</option>
                    </select>
                </td>
                <td class="px-6 py-4">
                    <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="Observaciones..." value="${att.observations || ''}"
                        onchange="updateObservations('${student.id}', this.value)">
                </td>
            </tr>
        `;
    }).join('');
}

function updateAttendance(studentId, status) {
    const today = new Date().toISOString().split('T')[0];
    const ref_path = `attendance/${today}/${studentId}`;
    
    set(ref(db, ref_path), {
        status: status,
        timestamp: Date.now(),
        updatedBy: currentUser?.email || 'anonymous'
    });
    
    showToast(`Estado actualizado: ${status}`);
}

function updateIncidents(studentId, incident) {
    const today = new Date().toISOString().split('T')[0];
    const ref_path = `attendance/${today}/${studentId}`;
    
    update(ref(db, ref_path), {
        incidents: incident,
        updatedAt: Date.now()
    });
}

function updateObservations(studentId, observations) {
    const today = new Date().toISOString().split('T')[0];
    const ref_path = `attendance/${today}/${studentId}`;
    
    update(ref(db, ref_path), {
        observations: observations,
        updatedAt: Date.now()
    });
}

function saveAttendance() {
    showToast('Asistencia guardada correctamente (sincronización en tiempo real activa)');
}

function loadTodayAttendance() {
    // Handled by listener
}

// Forms
function initForms() {
    // Teacher Form
    document.getElementById('teacherForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const teacher = {
            name: document.getElementById('teacherName').value,
            lastName: document.getElementById('teacherLastName').value,
            phone: document.getElementById('teacherPhone').value,
            specialty: document.getElementById('teacherSpecialty').value,
            createdAt: Date.now(),
            createdBy: currentUser?.email || 'anonymous'
        };
        
        try {
            await push(ref(db, 'teachers'), teacher);
            e.target.reset();
            showToast('Maestro registrado exitosamente');
            loadBitacora();
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    });
    
    // Student Form
    document.getElementById('studentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const student = {
            name: document.getElementById('studentName').value,
            lastName: document.getElementById('studentLastName').value,
            ci: document.getElementById('studentCI').value,
            phone: document.getElementById('studentPhone').value,
            tutor: document.getElementById('studentTutor').value,
            address: document.getElementById('studentAddress').value,
            grade: document.getElementById('studentGrade').value,
            createdAt: Date.now(),
            createdBy: currentUser?.email || 'anonymous'
        };
        
        try {
            await push(ref(db, 'students'), student);
            e.target.reset();
            showToast('Estudiante registrado exitosamente');
            loadBitacora();
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        }
    });
}

// Bitácora
function loadBitacora() {
    const tbody = document.getElementById('bitacoraTableBody');
    const allRecords = [
        ...teachersData.map(t => ({ ...t, type: 'Maestro' })),
        ...studentsData.map(s => ({ ...s, type: 'Estudiante' }))
    ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    if (allRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-400">No hay registros</td></tr>';
        return;
    }
    
    tbody.innerHTML = allRecords.slice(0, 50).map(record => `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-6 py-3">
                <span class="px-2 py-1 rounded text-xs font-medium ${record.type === 'Maestro' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">
                    ${record.type}
                </span>
            </td>
            <td class="px-6 py-3 font-medium">${record.name} ${record.lastName}</td>
            <td class="px-6 py-3 text-sm text-gray-600">${record.ci || record.phone || 'N/A'}</td>
            <td class="px-6 py-3 text-sm text-gray-600">${record.specialty || record.grade || record.tutor || '-'}</td>
            <td class="px-6 py-3 text-sm text-gray-500">
                ${record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'N/A'}
            </td>
        </tr>
    `).join('');
}

function exportBitacoraCSV() {
    const headers = ['Tipo', 'Nombre', 'Apellido', 'CI/Teléfono', 'Detalle', 'Fecha'];
    const rows = [
        ...teachersData.map(t => ['Maestro', t.name, t.lastName, t.phone, t.specialty, new Date(t.createdAt).toLocaleDateString()]),
        ...studentsData.map(s => ['Estudiante', s.name, s.lastName, s.ci, s.grade, new Date(s.createdAt).toLocaleDate Continúo con la segunda parte del archivo `app.js` y los archivos restantes:

## Continuación de `app.js`

```javascript
// Continuación del archivo app.js

// Bitácora (continuación)
function exportBitacoraCSV() {
    const headers = ['Tipo', 'Nombre', 'Apellido', 'CI/Teléfono', 'Detalle', 'Fecha'];
    const rows = [
        ...teachersData.map(t => ['Maestro', t.name, t.lastName, t.phone || '', t.specialty || '', new Date(t.createdAt || Date.now()).toLocaleDateString()]),
        ...studentsData.map(s => ['Estudiante', s.name, s.lastName, s.ci || s.phone || '', s.grade || '', new Date(s.createdAt || Date.now()).toLocaleDateString()])
    ];
    
    downloadCSV([headers, ...rows], 'bitacora_registros.csv');
}

function printBitacora() {
    window.print();
}

// Licenses
function loadLicenses() {
    const today = new Date().toISOString().split('T')[0];
    const licensesRef = ref(db, `attendance/${today}`);
    
    onValue(licensesRef, (snapshot) => {
        const data = snapshot.val() || {};
        const licenses = Object.entries(data)
            .filter(([_, val]) => val.status === 'licencia')
            .map(([id, val]) => {
                const student = studentsData.find(s => s.id === id);
                return { ...val, student };
            });
        
        const container = document.getElementById('licensesList');
        document.getElementById('licensesCount').textContent = licenses.length;
        
        if (licenses.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-center py-8">No hay licencias registradas hoy</p>';
            return;
        }
        
        container.innerHTML = licenses.map(license => `
            <div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-100">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center text-purple-700 font-bold">
                        ${license.student ? license.student.name[0] : 'L'}
                    </div>
                    <div>
                        <p class="font-medium text-gray-800">
                            ${license.student ? `${license.student.name} ${license.student.lastName}` : 'Estudiante'}
                        </p>
                        <p class="text-xs text-gray-500">${license.observations || 'Sin observaciones'}</p>
                    </div>
                </div>
                <span class="text-xs text-purple-600 font-medium bg-purple-100 px-2 py-1 rounded">
                    ${new Date(license.timestamp).toLocaleTimeString()}
                </span>
            </div>
        `).join('');
    });
}

// Utilities
function downloadCSV(data, filename) {
    const csv = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const icon = toast.querySelector('i');
    
    toastMessage.textContent = message;
    
    if (type === 'error') {
        icon.className = 'fas fa-exclamation-circle text-red-400';
    } else {
        icon.className = 'fas fa-check-circle text-green-400';
    }
    
    toast.classList.add('toast-show');
    
    setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 3000);
}

// Expose functions to window for HTML onclick handlers
window.showSection = showSection;
window.toggleSidebar = toggleSidebar;
window.toggleLogin = toggleLogin;
window.closeLogin = closeLogin;
window.logout = logout;
window.openTeacherForm = openTeacherForm;
window.showTeacherProfile = showTeacherProfile;
window.closeTeacherModal = closeTeacherModal;
window.deleteTeacher = deleteTeacher;
window.filterStudents = filterStudents;
window.exportStudentsCSV = exportStudentsCSV;
window.printStudents = printStudents;
window.editStudent = editStudent;
window.deleteStudent = deleteStudent;
window.loadAttendanceTable = loadAttendanceTable;
window.updateAttendance = updateAttendance;
window.updateIncidents = updateIncidents;
window.updateObservations = updateObservations;
window.saveAttendance = saveAttendance;
window.exportBitacoraCSV = exportBitacoraCSV;
window.printBitacora = printBitacora;
