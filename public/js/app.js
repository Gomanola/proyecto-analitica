// ==========================================================================
// APLICACIÓN PRINCIPAL - CONTROLADOR FRONTEND (SPA & CHARTS)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar componentes globales
    initNavigation();
    initDashboard();
    initRandomForest();
    initRegresion1();
    initRegresion2_1();
    initRegresion2_2();
});

// --------------------------------------------------------------------------
// 1. NAVEGACIÓN Y ENRUTAMIENTO (SPA)
// --------------------------------------------------------------------------
function initNavigation() {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menuBtn');
    const closeSidebar = document.getElementById('closeSidebar');
    const dropdownToggle = document.getElementById('dropdownToggle');
    const dropdownContainer = dropdownToggle.parentElement;
    const menuLinks = document.querySelectorAll('.menu-link');
    const panelSections = document.querySelectorAll('.panel-section');
    const pageTitle = document.getElementById('pageTitle');

    // Toggle Sidebar móvil
    menuBtn.addEventListener('click', () => sidebar.classList.add('open'));
    closeSidebar.addEventListener('click', () => sidebar.classList.remove('open'));

    // Toggle Dropdown Regresión Lineal 2
    dropdownToggle.addEventListener('click', (e) => {
        e.preventDefault();
        dropdownContainer.classList.toggle('open');
    });

    // Enrutador basado en Hash
    function router() {
        const hash = window.location.hash || '#inicio';
        let targetPanelId = 'panel-inicio';
        let title = 'Inicio / Dashboard';

        // Mapear link activo
        menuLinks.forEach(link => {
            if (link.getAttribute('href') === hash) {
                link.classList.add('active');
                targetPanelId = link.getAttribute('data-target');
                
                // Buscar título
                if (hash === '#inicio') title = 'Inicio / Dashboard';
                else if (hash === '#random-forest') title = 'Random Forest Classifier';
                else if (hash === '#regresion-1') title = 'Regresión Lineal 1: Inversión vs Ventas';
                else if (hash === '#regresion-2-1') title = 'Regresión Lineal 2: Repartidores';
                else if (hash === '#regresion-2-2') title = 'Regresión Lineal 2: Backups';
                
                // Si el link está dentro del dropdown, mantenerlo abierto
                if (link.closest('.dropdown-submenu')) {
                    dropdownContainer.classList.add('open');
                }
            } else {
                link.classList.remove('active');
            }
        });

        // Mostrar panel correspondiente
        panelSections.forEach(panel => {
            if (panel.id === targetPanelId) {
                panel.classList.add('active');
                pageTitle.textContent = title;
            } else {
                panel.classList.remove('active');
            }
        });

        // Cerrar sidebar en móviles tras click
        sidebar.classList.remove('open');
        
        // Disparar recarga de datos de la sección correspondiente
        triggerSectionReload(hash);
    }

    window.addEventListener('hashchange', router);
    // Carga inicial
    router();
}

function triggerSectionReload(hash) {
    if (hash === '#inicio') loadDashboardStats();
    else if (hash === '#random-forest') loadPatientExplorer();
    else if (hash === '#regresion-1') loadRegresion1Data();
    else if (hash === '#regresion-2-1') loadRegresion2_1Data();
    else if (hash === '#regresion-2-2') loadRegresion2_2Data();
}

// --------------------------------------------------------------------------
// 2. DASHBOARD / ESTADÍSTICAS
// --------------------------------------------------------------------------
function initDashboard() {
    loadDashboardStats();
}

async function loadDashboardStats() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        document.getElementById('stats-rf').textContent = data.counts.registro_a.toLocaleString();
        document.getElementById('stats-rl1').textContent = data.counts.reportes.toLocaleString();
        document.getElementById('stats-rl2-1').textContent = data.counts.repartidores.toLocaleString();
        document.getElementById('stats-rl2-2').textContent = data.counts.historicos.toLocaleString();
        
        const dbStatus = document.getElementById('dbStatus');
        dbStatus.className = 'db-badge connected';
        dbStatus.querySelector('.db-text').textContent = 'DB: ' + data.database.split(' ')[0];
        document.getElementById('dbTypeBadge').textContent = data.database;
    } catch (e) {
        console.error('Error al cargar estadísticas del dashboard:', e);
        const dbStatus = document.getElementById('dbStatus');
        dbStatus.className = 'db-badge disconnected';
        dbStatus.querySelector('.db-text').textContent = 'Sin Conexión';
    }
}

// --------------------------------------------------------------------------
// 3. RANDOM FOREST (NLP DETECTIVE, PREDICTOR, EXPLORER)
// --------------------------------------------------------------------------
let rfDiagnoses = [];
let rfInterventions = [];
let explorerCurrentPage = 1;

function initRandomForest() {
    // 3.1 Manejo de pestañas internas
    const tabButtons = document.querySelectorAll('.rf-tab-btn');
    const tabContents = document.querySelectorAll('.rf-tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'rf-explorer') loadPatientExplorer();
        });
    });

    // Cargar sugerencias de autocompletado desde API
    fetch('/api/random-forest/diagnoses').then(r => r.json()).then(data => rfDiagnoses = data);
    fetch('/api/random-forest/interventions').then(r => r.json()).then(data => rfInterventions = data);

    // Configurar autocompletado
    setupAutocomplete(document.getElementById('rfDx'), document.getElementById('rfDxAutocomplete'), () => rfDiagnoses);
    setupAutocomplete(document.getElementById('rfIntervencion'), document.getElementById('rfIntervencionAutocomplete'), () => rfInterventions);

    // 3.2 ETAPA 1: DETECTIVE NLP CON CONSOLA DE EJECUCIÓN
    const terminalLog = document.getElementById('terminalLog');
    const btnRunDetectiveAll = document.getElementById('btnRunDetectiveAll');
    const btnTrainRFAll = document.getElementById('btnTrainRFAll');

    function logToTerminal(text, type = 'info') {
        const div = document.createElement('div');
        if (type === 'info') {
            div.style.color = '#ffffff'; // Blanco
            div.textContent = `> ${text}`;
        } else if (type === 'error') {
            div.style.color = '#71717a'; // Gris medio
            div.textContent = `[Error] ${text}`;
        } else if (type === 'system') {
            div.style.color = '#52525b'; // Gris oscuro
            div.textContent = `[Sistema] ${text}`;
        } else if (type === 'stdout') {
            div.style.color = '#d4d4d8'; // Gris claro
            div.textContent = text;
        }
        terminalLog.appendChild(div);
        // Desplazar terminal hacia abajo
        terminalLog.parentElement.scrollTop = terminalLog.parentElement.scrollHeight;
    }

    btnRunDetectiveAll.addEventListener('click', async () => {
        terminalLog.innerHTML = '';
        logToTerminal('Iniciando Detective', 'info');
        logToTerminal('Total a procesar: 117,834 expedientes.', 'info');
        logToTerminal('Estrategia: lotes de 10,000 registros para optimizar RAM.', 'info');
        logToTerminal('Analizando expedientes en la base de datos (lote masivo)...', 'info');

        btnRunDetectiveAll.disabled = true;
        btnTrainRFAll.disabled = true;

        try {
            const res = await fetch('/api/random-forest/detective/run-all', { method: 'POST' });
            const data = await res.json();
            
            btnRunDetectiveAll.disabled = false;

            if (data.success) {
                logToTerminal('Procesamiento completado con éxito.', 'info');
                logToTerminal(`Se escanearon: ${data.totalScanned.toLocaleString()} registros.`, 'info');
                logToTerminal(`Se corrigieron y actualizaron: ${data.totalUpdated.toLocaleString()} discrepancias.`, 'info');
                logToTerminal('¡Operación exitosa! Base de datos actualizada con la nueva columna de mortalidad.', 'info');
                
                btnTrainRFAll.disabled = false; // Habilitar botón de entrenamiento
                loadDashboardStats();
                loadPatientExplorer();
            } else {
                logToTerminal(data.error || 'Ocurrió un error desconocido.', 'error');
            }
        } catch (e) {
            console.error(e);
            btnRunDetectiveAll.disabled = false;
            logToTerminal('Error de conexión o fallo al ejecutar el análisis por lotes.', 'error');
        }
    });

    btnTrainRFAll.addEventListener('click', async () => {
        logToTerminal('Iniciando reentrenamiento del modelo Random Forest en segundo plano...', 'info');
        logToTerminal('Ejecutando scripts/train_rf.py en el entorno virtual...', 'info');
        logToTerminal('Por favor espere (~15-20 segundos)...', 'system');
        
        btnTrainRFAll.disabled = true;
        btnRunDetectiveAll.disabled = true;

        try {
            const res = await fetch('/api/random-forest/model/train', { method: 'POST' });
            const data = await res.json();
            
            btnRunDetectiveAll.disabled = false;

            if (data.success) {
                if (data.stdout) {
                    const lines = data.stdout.split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            logToTerminal(line, 'stdout');
                        }
                    });
                }
                logToTerminal('¡Entrenamiento completado y cargado en memoria exitosamente!', 'info');
            } else {
                btnTrainRFAll.disabled = false;
                logToTerminal(data.error || 'Error al entrenar.', 'error');
            }
        } catch (e) {
            console.error(e);
            btnRunDetectiveAll.disabled = false;
            btnTrainRFAll.disabled = false;
            logToTerminal('Error de conexión con el backend al intentar entrenar el modelo.', 'error');
        }
    });

    // 3.3 ETAPA 2: PREDICTOR SIMULADOR
    const btnPredictRF = document.getElementById('btnPredictRF');
    const rfDx = document.getElementById('rfDx');
    const rfIntervencion = document.getElementById('rfIntervencion');
    const rfCantidad = document.getElementById('rfCantidad');
    const rfTarifa = document.getElementById('rfTarifa');
    const predictorPlaceholder = document.getElementById('predictorPlaceholder');
    const predictorResult = document.getElementById('predictorResult');
    
    btnPredictRF.addEventListener('click', async () => {
        const dx = rfDx.value.trim();
        const intervencion = rfIntervencion.value.trim();
        const cantidad = parseInt(rfCantidad.value) || 0;
        const tarifa = parseInt(rfTarifa.value) || 0;

        if (!dx || !intervencion) return alert('Por favor completa los campos Diagnosis e Intervención.');

        try {
            const res = await fetch('/api/random-forest/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dx, intervencion, cantidad, tarifa })
            });
            const data = await res.json();

            predictorPlaceholder.classList.add('hidden');
            predictorResult.classList.remove('hidden');

            const verdictBanner = document.getElementById('predictorVerdictBanner');
            const verdictText = document.getElementById('predictorVerdictText');
            
            if (data.prediccion === 1) {
                verdictBanner.className = 'verdict-banner die';
                verdictText.textContent = 'PRONÓSTICO: FALLECIMIENTO';
            } else {
                verdictBanner.className = 'verdict-banner survive';
                verdictText.textContent = 'PRONÓSTICO: SOBREVIVENCIA';
            }

            // Actualizar barras
            const probSurv = (data.sobrevivencia_probabilidad * 100).toFixed(1);
            const probDie = (data.mortalidad_probabilidad * 100).toFixed(1);
            
            document.getElementById('probSobreviveText').textContent = `${probSurv}%`;
            document.getElementById('probSobreviveBar').style.width = `${probSurv}%`;
            
            document.getElementById('probFalleceText').textContent = `${probDie}%`;
            document.getElementById('probFalleceBar').style.width = `${probDie}%`;

            // Metadatos
            document.getElementById('encodedDxVal').textContent = `${data.dx_encoded} (${data.dx})`;
            document.getElementById('encodedIntVal').textContent = `${data.intervencion_encoded} (${data.intervencion})`;
        } catch (e) {
            console.error(e);
            alert('Error en la predicción');
        }
    });

    // Ajustar presets de casos
    document.getElementById('preset1').addEventListener('click', () => fillPreset("NEUMONIA NO ESPECIFICADA", "URGENCIAS", 2, 1200));
    document.getElementById('preset2').addEventListener('click', () => fillPreset("COVID-19", "TERAPIA INTENSIVA", 15, 250000));
    document.getElementById('preset3').addEventListener('click', () => fillPreset("COVID-19", "URGENCIAS", 1, 500));

    function fillPreset(dx, int, qty, rate) {
        rfDx.value = dx;
        rfIntervencion.value = int;
        rfCantidad.value = qty;
        rfTarifa.value = rate;
        btnPredictRF.click();
    }

    // 3.4 EXPLORADOR DE PACIENTES
    const patientSearch = document.getElementById('patientSearch');
    const mortalidadFilter = document.getElementById('mortalidadFilter');
    const btnPrevPage = document.getElementById('btnPrevPage');
    const btnNextPage = document.getElementById('btnNextPage');

    let debounceTimer;
    patientSearch.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            explorerCurrentPage = 1;
            loadPatientExplorer();
        }, 300);
    });

    mortalidadFilter.addEventListener('change', () => {
        explorerCurrentPage = 1;
        loadPatientExplorer();
    });

    btnPrevPage.addEventListener('click', () => {
        if (explorerCurrentPage > 1) {
            explorerCurrentPage--;
            loadPatientExplorer();
        }
    });

    btnNextPage.addEventListener('click', () => {
        explorerCurrentPage++;
        loadPatientExplorer();
    });
}

async function loadPatientExplorer() {
    const search = document.getElementById('patientSearch').value.trim();
    const mortalidad = document.getElementById('mortalidadFilter').value;
    const tbody = document.getElementById('patientsTableBody');
    
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando pacientes...</td></tr>`;

    try {
        const res = await fetch(`/api/random-forest/patients?page=${explorerCurrentPage}&limit=10&search=${encodeURIComponent(search)}&mortalidad=${mortalidad}`);
        const data = await res.json();
        
        tbody.innerHTML = '';
        if (data.patients.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No se encontraron registros.</td></tr>`;
            document.getElementById('paginationInfo').textContent = 'Mostrando 0 registros';
            return;
        }

        data.patients.forEach(p => {
            const tr = document.createElement('tr');
            
            const isFallecido = p.mortalidad === 1;
            const badgeClass = isFallecido ? 'mortality-badge die' : 'mortality-badge live';
            const badgeText = isFallecido ? 'Fallecido' : 'Vivo';
            
            tr.innerHTML = `
                <td><strong>${p.id_a}</strong></td>
                <td>${p.nombre || ''} ${p.appat || ''}</td>
                <td>${p.edad || 0}</td>
                <td>${p.genero || ''}</td>
                <td title="${p.dx || ''}"><span>${p.dx ? (p.dx.length > 25 ? p.dx.substring(0, 25) + '...' : p.dx) : ''}</span></td>
                <td title="${p.intervencion || ''}"><span>${p.intervencion ? (p.intervencion.length > 20 ? p.intervencion.substring(0, 20) + '...' : p.intervencion) : ''}</span></td>
                <td>${p.cantidad || 0}</td>
                <td>$${(p.tarifa || 0).toLocaleString()}</td>
                <td><span class="${badgeClass}">${badgeText}</span></td>
                <td>
                    <div class="button-group" style="gap:4px">
                        <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;width:auto;" onclick="loadPatientInPredictor('${escapeHtml(p.dx)}', '${escapeHtml(p.intervencion)}', ${p.cantidad}, ${p.tarifa})">
                            <i class="fa-solid fa-share-from-square"></i>
                        </button>
                        <button class="btn btn-outline btn-danger" style="padding:4px 8px;font-size:11px;width:auto;" onclick="runDetectiveOnPatient(${p.id_a}, \`${escapeJsString(p.resclin || '')}\`, ${p.mortalidad})">
                            <i class="fa-solid fa-fingerprint"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Actualizar Info Paginación
        const from = (data.pagination.page - 1) * data.pagination.limit + 1;
        const to = Math.min(from + data.patients.length - 1, data.pagination.total);
        document.getElementById('paginationInfo').textContent = `Mostrando ${from} a ${to} de ${data.pagination.total.toLocaleString()} registros`;

        // Habilitar / deshabilitar botones
        document.getElementById('btnPrevPage').disabled = (explorerCurrentPage === 1);
        document.getElementById('btnNextPage').disabled = (explorerCurrentPage >= data.pagination.pages);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-secondary)">Error al cargar pacientes de la base de datos.</td></tr>`;
    }
}

// Expone funciones globales para los botones de las celdas
window.loadPatientInPredictor = function(dx, int, qty, rate) {
    document.getElementById('rfDx').value = dx;
    document.getElementById('rfIntervencion').value = int;
    document.getElementById('rfCantidad').value = qty;
    document.getElementById('rfTarifa').value = rate;
    
    // Cambiar a pestaña Predictor
    const tabButtons = document.querySelectorAll('.rf-tab-btn');
    const tabContents = document.querySelectorAll('.rf-tab-content');
    tabButtons.forEach(b => {
        if (b.getAttribute('data-tab') === 'rf-predictor') b.classList.add('active');
        else b.classList.remove('active');
    });
    tabContents.forEach(c => {
        if (c.id === 'rf-predictor') c.classList.add('active');
        else c.classList.remove('active');
    });

    document.getElementById('btnPredictRF').click();
};

window.runDetectiveOnPatient = async function(id_a, resclin, currentMortality) {
    if (!resclin) return alert("Este registro no cuenta con notas clínicas (resclin) para analizar.");
    
    try {
        const res = await fetch('/api/random-forest/detective', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: resclin })
        });
        const data = await res.json();
        
        const detectedVal = data.detected ? 1 : 0;
        let msg = `Análisis de Detective para Paciente ID ${id_a}:\n\n` + 
                  `Diagnóstico Semántico: ${data.verdict}\n` +
                  `Palabras encontradas: ${data.matches.join(', ') || 'Ninguna'}\n\n`;
        
        if (detectedVal !== currentMortality) {
            msg += `¡Discordancia detectada! El estado registrado era "${currentMortality === 1 ? 'Fallecido' : 'Vivo'}" pero el análisis indica "${detectedVal === 1 ? 'Fallecido' : 'Vivo'}".\n` +
                   `¿Deseas actualizar la base de datos con el diagnóstico de Detective?`;
            
            if (confirm(msg)) {
                const updateRes = await fetch('/api/random-forest/patients/update-mortality', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_a, mortalidad: detectedVal })
                });
                const updateData = await updateRes.json();
                if (updateData.success) {
                    alert("Base de datos actualizada con éxito.");
                    loadPatientExplorer();
                }
            }
        } else {
            msg += `El estado coincide perfectamente con el registro en la base de datos (${currentMortality === 1 ? 'Fallecido' : 'Vivo'}).`;
            alert(msg);
        }
    } catch (e) {
        console.error(e);
        alert("Error al analizar al paciente.");
    }
};

// --------------------------------------------------------------------------
// 4. REGRESIÓN LINEAL 1: INVERSIÓN VS VENTAS
// --------------------------------------------------------------------------
let chartRL1 = null;

function initRegresion1() {
    document.getElementById('btnSimulateMonth').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/regresion-1/predict', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`Predicción de Mes ${data.predicted.mes} completada.\n` +
                      `Inversión Progresiva: $${data.predicted.inversion.toFixed(2)}\n` +
                      `Ventas Estimadas: $${data.predicted.ventas.toFixed(2)}`);
                updateRL1UI(data);
            }
        } catch (e) {
            console.error(e);
            alert('Error al simular mes.');
        }
    });

    document.getElementById('btnAddRL1').addEventListener('click', async () => {
        const mes = document.getElementById('rl1Mes').value;
        const inversion = document.getElementById('rl1Inversion').value;
        const ventas = document.getElementById('rl1Ventas').value;

        if (!mes || !inversion || !ventas) return alert('Completa todos los campos.');

        try {
            const res = await fetch('/api/regresion-1/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mes, inversion, ventas })
            });
            const data = await res.json();
            if (data.success) {
                updateRL1UI(data);
                document.getElementById('rl1Mes').value = '';
                document.getElementById('rl1Inversion').value = '';
                document.getElementById('rl1Ventas').value = '';
            }
        } catch (e) {
            console.error(e);
        }
    });

    document.getElementById('btnResetRL1').addEventListener('click', async () => {
        if (!confirm('¿Restablecer el historial de ventas a los 8 meses predeterminados?')) return;
        try {
            const res = await fetch('/api/regresion-1/reset', { method: 'POST' });
            const data = await res.json();
            updateRL1UI(data);
        } catch (e) {
            console.error(e);
        }
    });
}

async function loadRegresion1Data() {
    try {
        const res = await fetch('/api/regresion-1/data');
        const data = await res.json();
        updateRL1UI(data);
    } catch (e) {
        console.error(e);
    }
}

function updateRL1UI({ data, model }) {
    // 1. Llenar tabla
    const tbody = document.getElementById('tableBodyRL1');
    tbody.innerHTML = data.map(r => `
        <tr>
            <td>Mes ${r.mes}</td>
            <td>$${r.inversion.toFixed(2)}</td>
            <td>$${r.ventas.toFixed(2)}</td>
        </tr>
    `).join('');

    // 2. Coeficientes
    const b0 = model.b0;
    const b1 = model.b1;
    const r2 = model.r2;
    const sign = b0 >= 0 ? '+' : '-';
    document.getElementById('eqResult1').innerHTML = `Ecuación Ajustada:<br><strong>Ventas = ${b1.toFixed(4)} × Inversión ${sign} ${Math.abs(b0).toFixed(4)}</strong><br><span style="font-size:12px;color:var(--text-secondary)">Coeficiente R²: ${(r2 * 100).toFixed(2)}%</span>`;

    // 3. Renderizar Gráfico
    const scatterData = data.map(r => ({ x: r.inversion, y: r.ventas }));
    
    // Generar línea de regresión (mínimos y máximos)
    const minX = Math.min(...data.map(r => r.inversion)) * 0.9;
    const maxX = Math.max(...data.map(r => r.inversion)) * 1.1;
    
    const regressionLine = [
        { x: minX, y: b0 + b1 * minX },
        { x: maxX, y: b0 + b1 * maxX }
    ];

    if (chartRL1) chartRL1.destroy();

    const ctx = document.getElementById('chartRegresion1').getContext('2d');
    chartRL1 = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Observaciones Reales',
                    data: scatterData,
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Línea de Regresión',
                    data: regressionLine,
                    type: 'line',
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Inversión ($)', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    title: { display: true, text: 'Ventas ($)', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });
}

// --------------------------------------------------------------------------
// 5. REGRESIÓN LINEAL 2 - EJERCICIO 1 (REPARTIDORES)
// --------------------------------------------------------------------------
let chartRL21 = null;

function initRegresion2_1() {
    document.getElementById('btnPredictRL21').addEventListener('click', async () => {
        const distancia = document.getElementById('rl21DistInput').value;
        if (!distancia) return alert('Ingresa una distancia.');

        try {
            const res = await fetch('/api/regresion-2-1/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ distancia })
            });
            const data = await res.json();
            
            const card = document.getElementById('calcResultRL21');
            card.classList.remove('hidden');
            document.getElementById('calcResultRL21Val').textContent = `${data.tiempo_estimado.toFixed(2)} min`;
        } catch (e) {
            console.error(e);
        }
    });

    document.getElementById('btnAddRL21').addEventListener('click', async () => {
        const distancia = document.getElementById('rl21Dist').value;
        const tiempo = document.getElementById('rl21Tiempo').value;

        if (!distancia || !tiempo) return alert('Completa todos los campos.');

        try {
            const res = await fetch('/api/regresion-2-1/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ distancia, tiempo })
            });
            const data = await res.json();
            if (data.success) {
                updateRL21UI(data);
                document.getElementById('rl21Dist').value = '';
                document.getElementById('rl21Tiempo').value = '';
            }
        } catch (e) {
            console.error(e);
        }
    });

    document.getElementById('btnResetRL21').addEventListener('click', async () => {
        if (!confirm('¿Restablecer a los 5 repartidores predeterminados?')) return;
        try {
            const res = await fetch('/api/regresion-2-1/reset', { method: 'POST' });
            const data = await res.json();
            updateRL21UI(data);
        } catch (e) {
            console.error(e);
        }
    });
}

async function loadRegresion2_1Data() {
    try {
        const res = await fetch('/api/regresion-2-1/data');
        const data = await res.json();
        updateRL21UI(data);
    } catch (e) {
        console.error(e);
    }
}

function updateRL21UI({ data, model }) {
    const tbody = document.getElementById('tableBodyRL21');
    tbody.innerHTML = data.map(r => `
        <tr>
            <td># ${r.id}</td>
            <td>${r.distancia.toFixed(2)} km</td>
            <td>${r.tiempo.toFixed(2)} min</td>
        </tr>
    `).join('');

    const b0 = model.b0;
    const b1 = model.b1;
    const r2 = model.r2;
    const sign = b0 >= 0 ? '+' : '-';
    document.getElementById('eqResult21').innerHTML = `Ecuación Ajustada:<br><strong>Tiempo = ${b1.toFixed(4)} × Distancia ${sign} ${Math.abs(b0).toFixed(4)}</strong><br><span style="font-size:12px;color:var(--text-secondary)">Coeficiente R²: ${(r2 * 100).toFixed(2)}%</span>`;

    const scatterData = data.map(r => ({ x: r.distancia, y: r.tiempo }));
    const minX = Math.min(...data.map(r => r.distancia)) * 0.9;
    const maxX = Math.max(...data.map(r => r.distancia)) * 1.1;
    
    const regressionLine = [
        { x: minX, y: b0 + b1 * minX },
        { x: maxX, y: b0 + b1 * maxX }
    ];

    if (chartRL21) chartRL21.destroy();

    const ctx = document.getElementById('chartRegresion21').getContext('2d');
    chartRL21 = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Repartidores',
                    data: scatterData,
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Línea de Regresión',
                    data: regressionLine,
                    type: 'line',
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Distancia (km)', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    title: { display: true, text: 'Tiempo (minutos)', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });
}

// --------------------------------------------------------------------------
// 6. REGRESIÓN LINEAL 2 - EJERCICIO 2 (HISTÓRICOS BACKUP)
// --------------------------------------------------------------------------
let chartRL22 = null;

function initRegresion2_2() {
    document.getElementById('btnPredictRL22').addEventListener('click', async () => {
        const usuarios = document.getElementById('rl22UsersInput').value;
        if (!usuarios) return alert('Ingresa el número de usuarios.');

        try {
            const res = await fetch('/api/regresion-2-2/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuarios })
            });
            const data = await res.json();
            
            const card = document.getElementById('calcResultRL22');
            card.classList.remove('hidden');
            document.getElementById('calcResultRL22Val').textContent = `${data.backup_estimado.toFixed(2)} GB`;
        } catch (e) {
            console.error(e);
        }
    });

    document.getElementById('btnAddRL22').addEventListener('click', async () => {
        const usuarios = document.getElementById('rl22Users').value;
        const backup = document.getElementById('rl22Backup').value;

        if (!usuarios || !backup) return alert('Completa todos los campos.');

        try {
            const res = await fetch('/api/regresion-2-2/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuarios, backup })
            });
            const data = await res.json();
            if (data.success) {
                updateRL22UI(data);
                document.getElementById('rl22Users').value = '';
                document.getElementById('rl22Backup').value = '';
            }
        } catch (e) {
            console.error(e);
        }
    });

    document.getElementById('btnResetRL22').addEventListener('click', async () => {
        if (!confirm('¿Restablecer a los datos históricos predeterminados?')) return;
        try {
            const res = await fetch('/api/regresion-2-2/reset', { method: 'POST' });
            const data = await res.json();
            updateRL22UI(data);
        } catch (e) {
            console.error(e);
        }
    });
}

async function loadRegresion2_2Data() {
    try {
        const res = await fetch('/api/regresion-2-2/data');
        const data = await res.json();
        updateRL22UI(data);
    } catch (e) {
        console.error(e);
    }
}

function updateRL22UI({ data, model }) {
    const tbody = document.getElementById('tableBodyRL22');
    tbody.innerHTML = data.map(r => `
        <tr>
            <td># ${r.id}</td>
            <td>${r.usuarios.toLocaleString()}</td>
            <td>${r.backup.toFixed(2)} GB</td>
        </tr>
    `).join('');

    const b0 = model.b0;
    const b1 = model.b1;
    const r2 = model.r2;
    const sign = b0 >= 0 ? '+' : '-';
    document.getElementById('eqResult22').innerHTML = `Ecuación Ajustada:<br><strong>Backup = ${b1.toFixed(6)} × Usuarios ${sign} ${Math.abs(b0).toFixed(4)}</strong><br><span style="font-size:12px;color:var(--text-secondary)">Coeficiente R²: ${(r2 * 100).toFixed(2)}%</span>`;

    const scatterData = data.map(r => ({ x: r.usuarios, y: r.backup }));
    const minX = Math.min(...data.map(r => r.usuarios)) * 0.9;
    const maxX = Math.max(...data.map(r => r.usuarios)) * 1.1;
    
    const regressionLine = [
        { x: minX, y: b0 + b1 * minX },
        { x: maxX, y: b0 + b1 * maxX }
    ];

    if (chartRL22) chartRL22.destroy();

    const ctx = document.getElementById('chartRegresion22').getContext('2d');
    chartRL22 = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Copias de Seguridad',
                    data: scatterData,
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Línea de Regresión',
                    data: regressionLine,
                    type: 'line',
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Usuarios Activos', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    title: { display: true, text: 'Tamaño Backup (GB)', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });
}

// --------------------------------------------------------------------------
// HELPERS GENERALES (AUTOCOMPLETE & SANITIZATION)
// --------------------------------------------------------------------------
function setupAutocomplete(input, container, itemsGetter) {
    input.addEventListener('input', function() {
        const val = this.value;
        closeAllLists();
        if (!val) return false;
        
        let count = 0;
        const items = itemsGetter();
        const searchVal = val.toLowerCase();
        
        items.forEach(item => {
            if (item && item.toLowerCase().includes(searchVal) && count < 10) {
                const div = document.createElement('div');
                div.innerHTML = item.replace(new RegExp(`(${val})`, 'gi'), "<strong>$1</strong>");
                div.addEventListener('click', function() {
                    input.value = item;
                    closeAllLists();
                });
                container.appendChild(div);
                count++;
            }
        });
    });

    document.addEventListener('click', function(e) {
        if (e.target !== input) closeAllLists();
    });

    function closeAllLists() {
        container.innerHTML = '';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJsString(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}
