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
    remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ============================================
// CONFIGURACIÓN FIREBASE
// ============================================
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

// ============================================
// ESTADO GLOBAL
// ============================================
let currentUser = null;
let studentsData = [];
let teachersData = [];
let todayAttendance = {};
let charts = {};
let currentSection = 'dashboard';

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 App iniciada');
    
    initDateTime();           // ← HORA EN TIEMPO REAL
    initAuth();
    initListeners();
    initForms();
    initNavigation();         // ← NAVEGACIÓN CORREGIDA
    generateHeatmap();
    
    // Mostrar sección inicial
    showSection('dashboard');
});

// ============================================
// HORA EN TIEMPO REAL (cada segundo)
// ============================================
function initDateTime() {
    const updateDateTime = () => {
        const now = new Date();
        
        // Fecha larga
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const dateEl = document.getElementById('currentDate');
        if (dateEl) dateEl.textContent = now.toLocaleDateString('es-ES', dateOptions);
        
        // Hora con segundos (TIEMPO REAL)
        const timeEl = document.getElementById('currentTime');
        if (timeEl) {
            timeEl.textContent = now.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false 
            });
        }
        
        // Fecha en toma de lista
        const listaDateEl = document.getElementById('listaDate');
        if (listaDateEl) {
            listaDateEl.textContent = `Fecha: ${now.toLocaleDateString('es-ES')}`;
        }
    };
    
    updateDateTime();
    setInterval(updateDateTime, 1000); // ← Actualiza cada SEGUNDO
}

// ============================================
// NAVEGACIÓN CORREGIDA
// ============================================
function initNavigation() {
    // Botones del sidebar
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const section = btn.dataset.section;
            if (section) {
                console.log('Navegando a:', section);
                showSection(section);
            }
        });
    });
    
    // Botón hamburguesa
    const hamburgerBtn = document.querySelector('header button[onclick="toggleSidebar()"]');
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }
}

function showSection(sectionId) {
    console.log('Mostrando sección:', sectionId);
    currentSection = sectionId;
    
    // Ocultar TODAS las secciones
    document.querySelectorAll('.section-content').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Mostrar sección objetivo
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active-section');
    } else {
        console.error('Sección no encontrada:', sectionId);
        return;
    }
    
    // Actualizar botones de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.section === sectionId) {
            btn.classList.add('active');
        }
    });
    
    // Cerrar sidebar en móvil
    if (window.innerWidth < 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('-translate-x-full');
    }
    
    // Refrescar datos específicos
    if (sectionId === 'lista') {
        loadAttendanceTable();
    } else if (sectionId === 'bitacora') {
        loadBitacora();
    } else if (sectionId === 'maestros') {
        renderTeachers();
    } else if (sectionId === 'estudiantes') {
        filterStudents();
    } else if (sectionId === 'dashboard') {
        updateDashboard();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('-translate-x-full');
        console.log('Sidebar toggled');
    }
}

// ============================================
// AUTENTICACIÓN
// ============================================
function initAuth() {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        updateAuthUI();
    });
}

function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const userInfo = document.getElementById('userInfo');
    
    if (!authBtn) return;
    
    if (currentUser) {
        authBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span>Cerrar Sesión</span>';
        authBtn.onclick = logout;
        authBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        authBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        
        if (userInfo) userInfo.classList.remove('hidden');
        const userNameEl = document.getElementById('userName');
        const userEmailEl = document.getElementById('userEmail');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) userNameEl.textContent = currentUser.displayName || 'Usuario';
        if (userEmailEl) userEmailEl.textContent = currentUser.email;
        if (userAvatarEl) userAvatarEl.textContent = (currentUser.displayName || 'U')[0].toUpperCase();
    } else {
        authBtn.innerHTML = '<i class="fas fa-lock"></i> <span>Iniciar Sesión</span>';
        authBtn.onclick = toggleLogin;
        authBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        authBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        
        if (userInfo) userInfo.classList.add('hidden');
    }
}

function toggleLogin() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('hidden');
}

function closeLogin() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('hidden');
}

function logout() {
    signOut(auth).then(() => {
        showToast('Sesión cerrada');
    }).catch(err => {
        showToast('Error al cerrar sesión: ' + err.message, 'error');
    });
}

// Login form handler
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            
            if (!email || !password) {
                showToast('Complete todos los campos', 'error');
                return;
            }
            
            try {
                await signInWithEmailAndPassword(auth, email, password);
                closeLogin();
                showToast('Sesión iniciada correctamente');
            } catch (error) {
                showToast('Error: ' + error.message, 'error');
            }
        });
    }
});

// ============================================
// LISTENERS FIREBASE (Tiempo Real)
// ============================================
function initListeners() {
    // Estudiantes
    const studentsRef = ref(db, 'students');
    onValue(studentsRef, (snapshot) => {
        const data = snapshot.val();
        studentsData = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        console.log('📊 Estudiantes cargados:', studentsData.length);
        
        if (currentSection === 'dashboard') updateDashboard();
        if (currentSection === 'estudiantes') filterStudents();
        if (currentSection === 'lista') loadAttendanceTable();
    });
    
    // Maestros
    const teachersRef = ref(db, 'teachers');
    onValue(teachersRef, (snapshot) => {
        const data = snapshot.val();
        teachersData = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        console.log('👨‍🏫 Maestros cargados:', teachersData.length);
        
        if (currentSection === 'maestros') renderTeachers();
        if (currentSection === 'bitacora') loadBitacora();
    });
    
    // Asistencia de hoy
    const today = new Date().toISOString().split('T')[0];
    const attendanceRef = ref(db, `attendance/${today}`);
    onValue(attendanceRef, (snapshot) => {
        todayAttendance = snapshot.val() || {};
        console.log('✅ Asistencia actualizada');
        
        if (currentSection === 'dashboard') updateDashboard();
        if (currentSection === 'estudiantes') filterStudents();
        if (currentSection === 'lista') loadAttendanceTable();
    });
}

// ============================================
// DASHBOARD
// ============================================
function updateDashboard() {
    const total = studentsData.length;
    let asistencias = 0, ausentes = 0, atrasos = 0, licencias = 0;
    
    studentsData.forEach(student => {
        const status = todayAttendance[student.id]?.status || 'pendiente';
        if (status === 'asistio') asistencias++;
        else if (status === 'ausente') ausentes++;
        else if (status === 'atraso') atrasos++;
        else if (status === 'licencia') licencias++;
    });
    
    // Animar contadores
    animateCounter('totalStudents', total);
    animateCounter('todayAttendance', asistencias);
    animateCounter('todayAbsents', ausentes);
    animateCounter('todayLates', atrasos);
    
    // Porcentajes
    const totalChecked = asistencias + ausentes + atrasos + licencias;
    const attPercentEl = document.getElementById('attendancePercent');
    const absPercentEl = document.getElementById('absentPercent');
    const latePercentEl = document.getElementById('latePercent');
    
    if (attPercentEl) attPercentEl.textContent = total > 0 ? Math.round((asistencias / total) * 100) + '%' : '0%';
    if (absPercentEl) absPercentEl.textContent = total > 0 ? Math.round((ausentes / total) * 100) + '%' : '0%';
    if (latePercentEl) latePercentEl.textContent = total > 0 ? Math.round((atrasos / total) * 100) + '%' : '0%';
    
    // Actualizar gráficos
    updateCharts(asistencias, ausentes, atrasos, licencias, total);
    
    // Licencias
    loadLicensesList();
}

function animateCounter(id, target) {
    const element = document.getElementById(id);
    if (!element) return;
    
    const current = parseInt(element.textContent) || 0;
    if (current === target) return;
    
    const increment = target > current ? 1 : -1;
    const timer = setInterval(() => {
        const newValue = parseInt(element.textContent) + increment;
        element.textContent = newValue;
        if (newValue === target) clearInterval(timer);
    }, 15);
}

function updateCharts(asistencias, ausentes, atrasos, licencias, total) {
    const sparklineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } }
    };
    
    const trendData = Array.from({length: 7}, () => Math.floor(Math.random() * Math.max(total, 10)));
    
    // Destruir gráficos existentes
    Object.values(charts).forEach(chart => chart?.destroy?.());
    
    // Chart: Total Estudiantes
    const ctxStudents = document.getElementById('chartStudents')?.getContext('2d');
    if (ctxStudents) {
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
    }
    
    // Chart: Asistencias
    const ctxAttendance = document.getElementById('chartAttendance')?.getContext('2d');
    if (ctxAttendance) {
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
    }
    
    // Chart: Ausentes
    const ctxAbsents = document.getElementById('chartAbsents')?.getContext('2d');
    if (ctxAbsents) {
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
    }
    
    // Chart: Atrasos
    const ctxLates = document.getElementById('chartLates')?.getContext('2d');
    if (ctxLates) {
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
    }
    
    // Pie Chart
    const ctxPie = document.getElementById('pieChart')?.getContext('2d');
    if (ctxPie) {
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
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

// ============================================
// MAPA DE CALOR
// ============================================
function generateHeatmap() {
    const heatmap = document.getElementById('heatmap');
    if (!heatmap) return;
    
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    
    let html = '';
    const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    dayNames.forEach(day => {
        html += `<div class="text-center font-semibold text-gray-400 py-2">${day}</div>`;
    });
    
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="heatmap-cell heatmap-empty"></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const attendance = Math.random();
        let className = 'heatmap-empty';
        if (attendance > 0.8) className = 'heatmap-full';
        else if (attendance > 0.6) className = 'heatmap-high';
        else if (attendance > 0.3) className = 'heatmap-medium';
        else if (attendance > 0) className = 'heatmap-low';
        
        const isToday = day === now.getDate();
        const borderClass = isToday ? 'ring-2 ring-blue-500 ring-offset-1' : '';
        
        html += `<div class="heatmap-cell ${className} ${borderClass}" title="Día ${day}">${day}</div>`;
    }
    
    heatmap.innerHTML = html;
}

// ============================================
// LICENCIAS
// ============================================
function loadLicensesList() {
    const container = document.getElementById('licensesList');
    const countEl = document.getElementById('licensesCount');
    if (!container || !countEl) return;
    
    const licenses = Object.entries(todayAttendance)
        .filter(([_, val]) => val.status === 'licencia')
        .map(([id, val]) => {
            const student = studentsData.find(s => s.id === id);
            return { ...val, student, id };
        });
    
    countEl.textContent = licenses.length;
    
    if (licenses.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-8">No hay licencias registradas hoy</p>';
        return;
    }
    
    container.innerHTML = licenses.map(license => `
        <div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-100 hover:translate-x-1 transition">
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
                ${license.timestamp ? new Date(license.timestamp).toLocaleTimeString() : '--:--'}
            </span>
        </div>
    `).join('');
}

// ============================================
// MAESTROS
// ============================================
function renderTeachers() {
    const grid = document.getElementById('teachersGrid');
    if (!grid) return;
    
    if (teachersData.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400">No hay maestros registrados</div>';
        return;
    }
    
    grid.innerHTML = teachersData.map(teacher => `
        <div class="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition cursor-pointer" onclick="window.showTeacherProfile('${teacher.id}')">
            <div class="flex items-start justify-between mb-4">
                <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
                    ${teacher.name?.[0] || 'M'}${teacher.lastName?.[0] || 'M'}
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
    
    const modal = document.getElementById('teacherModal');
    const content = document.getElementById('teacherModalContent');
    if (!modal || !content) return;
    
    content.innerHTML = `
        <div class="flex items-center gap-4 mb-6">
            <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
                ${teacher.name?.[0] || 'M'}${teacher.lastName?.[0] || 'M'}
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
            <button onclick="window.closeTeacherModal()" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg transition">Cerrar</button>
            <button onclick="window.deleteTeacher('${teacherId}')" class="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg transition">Eliminar</button>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeTeacherModal() {
    const modal = document.getElementById('teacherModal');
    if (modal) modal.classList.add('hidden');
}

function openTeacherForm() {
    showSection('bitacora');
    setTimeout(() => {
        document.getElementById('teacherName')?.focus();
    }, 100);
}

function deleteTeacher(teacherId) {
    if (!confirm('¿Está seguro de eliminar este maestro?')) return;
    remove(ref(db, `teachers/${teacherId}`))
        .then(() => {
            showToast('Maestro eliminado');
            closeTeacherModal();
        })
        .catch(err => showToast('Error: ' + err.message, 'error'));
}

// ============================================
// ESTUDIANTES
// ============================================
function filterStudents() {
    const searchEl = document.getElementById('studentSearch');
    const statusEl = document.getElementById('statusFilter');
    const gradeEl = document.getElementById('gradeFilter');
    
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    const statusFilter = statusEl ? statusEl.value : '';
    const gradeFilter = gradeEl ? gradeEl.value : '';
    
    let filtered = studentsData.filter(student => {
        const fullName = `${student.name || ''} ${student.lastName || ''}`.toLowerCase();
        const matchSearch = fullName.includes(search) || (student.ci && student.ci.includes(search));
        
        const status = todayAttendance[student.id]?.status || 'pendiente';
        const matchStatus = !statusFilter || status === statusFilter;
        
        const matchGrade = !gradeFilter || student.grade === gradeFilter;
        
        return matchSearch && matchStatus && matchGrade;
    });
    
    renderStudentsTable(filtered);
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    const countEl = document.getElementById('studentsCount');
    
    if (!tbody) return;
    if (countEl) countEl.textContent = `${students.length} estudiantes`;
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">No se encontraron estudiantes</td></tr>';
        return;
    }
    
    tbody.innerHTML = students.map((student, index) => {
        const attendance = todayAttendance[student.id] || {};
        const status = attendance.status || 'pendiente';
        
        const statusClasses = {
            'asistio': 'status-asistio',
            'ausente': 'status-ausente',
            'atraso': 'status-atraso',
            'licencia': 'status-licencia',
            'pendiente': 'bg-gray-100 text-gray-600'
        };
        
        const statusTexts = {
            'asistio': 'Asistió',
            'ausente': 'Ausente',
            'atraso': 'Atraso',
            'licencia': 'Licencia',
            'pendiente': 'Pendiente'
        };
        
        const statusIcons = {
            'asistio': 'check',
            'ausente': 'times',
            'atraso': 'clock',
            'licencia': 'file-medical',
            'pendiente': 'circle'
        };
        
        return `
            <tr class="hover:bg-gray-50 transition">
                <td class="px-6 py-4 text-sm text-gray-500">${index + 1}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                            ${student.name?.[0] || 'E'}${student.lastName?.[0] || 'E'}
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
                    <span class="status-badge ${statusClasses[status] || statusClasses.pendiente}">
                        <i class="fas fa-${statusIcons[status] || 'circle'} text-xs"></i>
                        ${statusTexts[status] || 'Pendiente'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">${attendance.observations || '-'}</td>
                <td class="px-6 py-4">
                    <button onclick="window.editStudent('${student.id}')" class="text-blue-600 hover:text-blue-800 mr-2 p-1">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="window.deleteStudent('${student.id}')" class="text-red-600 hover:text-red-800 p-1">
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
            s.name || '',
            s.lastName || '',
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
    
    const nameEl = document.getElementById('studentName');
    const lastNameEl = document.getElementById('studentLastName');
    const ciEl = document.getElementById('studentCI');
    const phoneEl = document.getElementById('studentPhone');
    const tutorEl = document.getElementById('studentTutor');
    const addressEl = document.getElementById('studentAddress');
    const gradeEl = document.getElementById('studentGrade');
    
    if (nameEl) nameEl.value = student.name || '';
    if (lastNameEl) lastNameEl.value = student.lastName || '';
    if (ciEl) ciEl.value = student.ci || '';
    if (phoneEl) phoneEl.value = student.phone || '';
    if (tutorEl) tutorEl.value = student.tutor || '';
    if (addressEl) addressEl.value = student.address || '';
    if (gradeEl) gradeEl.value = student.grade || '';
    
    showSection('bitacora');
    showToast('Modo edición activado. Actualice los datos y guarde.');
}

function deleteStudent(studentId) {
    if (!confirm('¿Eliminar este estudiante?')) return;
    remove(ref(db, `students/${studentId}`))
        .then(() => showToast('Estudiante eliminado'))
        .catch(err => showToast('Error: ' + err.message, 'error'));
}

// ============================================
// TOMA DE LISTA
// ============================================
function loadAttendanceTable() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    
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
                            ${student.name?.[0] || 'E'}${student.lastName?.[0] || 'E'}
                        </div>
                        <div>
                            <p class="font-medium text-gray-900">${student.name} ${student.lastName}</p>
                            <p class="text-xs text-gray-500">${student.grade || ''}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <input type="radio" name="att_${student.id}" value="asistio" class="attendance-radio" 
                        ${status === 'asistio' ? 'checked' : ''} 
                        onchange="window.updateAttendance('${student.id}', 'asistio')">
                </td>
                <td class="px-6 py-4 text-center">
                    <input type="radio" name="att_${student.id}" value="ausente" class="attendance-radio" 
                        ${status === 'ausente' ? 'checked' : ''} 
                        onchange="window.updateAttendance('${student.id}', 'ausente')">
                </td>
                <td class="px-6 py-4 text-center">
                    <input type="radio" name="att_${student.id}" value="atraso" class="attendance-radio" 
                        ${status === 'atraso' ? 'checked' : ''} 
                        onchange="window.updateAttendance('${student.id}', 'atraso')">
                </td>
                <td class="px-6 py-4">
                    <select class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        onchange="window.updateIncidents('${student.id}', this.value)">
                        <option value="">Sin incidencias</option>
                        <option value="indisciplina" ${att.incidents === 'indisciplina' ? 'selected' : ''}>Indisciplina</option>
                        <option value="tareas" ${att.incidents === 'tareas' ? 'selected' : ''}>No trajo tareas</option>
                        <option value="uniforme" ${att.incidents === 'uniforme' ? 'selected' : ''}>Sin uniforme</option>
                        <option value="material" ${att.incidents === 'material' ? 'selected' : ''}>Sin material</option>
                        <option value="pelea" ${att.incidents === 'pelea' ? 'selected' : ''}>Pelea</option>
                    </select>
                </td>
                <td class="px-6 py-4">
                    <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="Observaciones..." value="${att.observations || ''}"
                        onchange="window.updateObservations('${student.id}', this.value)">
                </td>
            </tr>
        `;
    }).join('');
}

function updateAttendance(studentId, status) {
    const today = new Date().toISOString().split('T')[0];
    const attendanceRef = ref(db, `attendance/${today}/${studentId}`);
    
    set(attendanceRef, {
        status: status,
        timestamp: Date.now(),
        updatedBy: currentUser?.email || 'anonymous'
    }).then(() => {
        showToast(`Estado actualizado: ${status}`);
    }).catch(err => {
        showToast('Error: ' + err.message, 'error');
    });
}

function updateIncidents(studentId, incident) {
    const today = new Date().toISOString().split('T')[0];
    update(ref(db, `attendance/${today}/${studentId}`), {
        incidents: incident,
        updatedAt: Date.now()
    });
}

function updateObservations(studentId, observations) {
    const today = new Date().toISOString().split('T')[0'];
    update(ref(db, `attendance/${today}/${studentId}`), {
        observations: observations,
        updatedAt: Date.now()
    });
}

function saveAttendance() {
    showToast('✅ Asistencia sincronizada en tiempo real con Firebase');
}

// ============================================
// BITÁCORA Y FORMULARIOS
// ============================================
function initForms() {
    // Teacher Form
    const teacherForm = document.getElementById('teacherForm');
    if (teacherForm) {
        teacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const teacher = {
                name: document.getElementById('teacherName')?.value || '',
                lastName: document.getElementById('teacherLastName')?.value || '',
                phone: document.getElementById('teacherPhone')?.value || '',
                specialty: document.getElementById('teacherSpecialty')?.value || '',
                createdAt: Date.now(),
                createdBy: currentUser?.email || 'anonymous'
            };
            
            try {
                await push(ref(db, 'teachers'), teacher);
                teacherForm.reset();
                showToast('Maestro registrado exitosamente');
                loadBitacora();
            } catch (error) {
                showToast('Error: ' + error.message, 'error');
            }
        });
    }
    
    // Student Form
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const student = {
                name: document.getElementById('studentName')?.value || '',
                lastName: document.getElementById('studentLastName')?.value || '',
                ci: document.getElementById('studentCI')?.value || '',
                phone: document.getElementById('studentPhone')?.value || '',
                tutor: document.getElementById('studentTutor')?.value || '',
                address: document.getElementById('studentAddress')?.value || '',
                grade: document.getElementById('studentGrade')?.value || '',
                createdAt: Date.now(),
                createdBy: currentUser?.email || 'anonymous'
            };
            
            try {
                await push(ref(db, 'students'), student);
                studentForm.reset();
                showToast('Estudiante registrado exitosamente');
                loadBitacora();
            } catch (error) {
                showToast('Error: ' + error.message, 'error');
            }
        });
    }
}

function loadBitacora() {
    const tbody = document.getElementById('bitacoraTableBody');
    if (!tbody) return;
    
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
        ...teachersData.map(t => ['Maestro', t.name || '', t.lastName || '', t.phone || '', t.specialty || '', new Date(t.createdAt || Date.now()).toLocaleDateString()]),
        ...studentsData.map(s => ['Estudiante', s.name || '', s.lastName || '', s.ci || s.phone || '', s.grade || '', new Date(s.createdAt || Date.now()).toLocaleDateString()])
    ];
    
    downloadCSV([headers, ...rows], 'bitacora_registros.csv');
}

function printBitacora() {
    window.print();
}

// ============================================
// UTILIDADES
// ============================================
function downloadCSV(data, filename) {
    const csv = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const icon = toast?.querySelector('i');
    
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;
    
    if (icon) {
        if (type === 'error') {
            icon.className = 'fas fa-exclamation-circle text-red-400';
        } else {
            icon.className = 'fas fa-check-circle text-green-400';
        }
    }
    
    toast.classList.add('toast-show');
    
    setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 3000);
}

// ============================================
// EXPONER FUNCIONES GLOBALMENTE (CRÍTICO PARA HTML onclick)
// ============================================
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

console.log('✅ Todas las funciones expuestas globalmente');
