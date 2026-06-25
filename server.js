const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const rf = require('./randomForest');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache para autocompletado en Random Forest
let uniqueDiagnoses = [];
let uniqueInterventions = [];

// Cargar sugerencias de diagnóstico e intervención al iniciar
async function loadAutocompleteCache() {
    try {
        console.log('Cargando caché de autocompletado de diagnósticos e intervenciones...');
        const dxRows = await db.query.all("SELECT DISTINCT dx FROM registro_a WHERE dx IS NOT NULL ORDER BY dx ASC;");
        uniqueDiagnoses = dxRows.map(r => r.dx).filter(Boolean);
        
        const intRows = await db.query.all("SELECT DISTINCT intervencion FROM registro_a WHERE intervencion IS NOT NULL ORDER BY intervencion ASC;");
        uniqueInterventions = intRows.map(r => r.intervencion).filter(Boolean);
        
        console.log(`Caché cargada: ${uniqueDiagnoses.length} diagnósticos, ${uniqueInterventions.length} intervenciones.`);
    } catch (error) {
        console.error('Error al cargar caché de autocompletado:', error);
    }
}

// ----------------------------------------------------
// ENDPOINTS GENERALES / MONITOREO
// ----------------------------------------------------

app.get('/api/status', async (req, res) => {
    try {
        const patientsCount = await db.query.get("SELECT COUNT(*) as count FROM registro_a;");
        const rl1Count = await db.query.get("SELECT COUNT(*) as count FROM reportes;");
        const rl2ej1Count = await db.query.get("SELECT COUNT(*) as count FROM repartidores;");
        const rl2ej2Count = await db.query.get("SELECT COUNT(*) as count FROM historicos;");
        
        res.json({
            database: "SQLite (proyecto.db)",
            status: "Connected",
            counts: {
                registro_a: patientsCount.count,
                reportes: rl1Count.count,
                repartidores: rl2ej1Count.count,
                historicos: rl2ej2Count.count
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----------------------------------------------------
// ENDPOINTS: RANDOM FOREST & DETECTIVE
// ----------------------------------------------------

app.get('/api/random-forest/diagnoses', (req, res) => {
    res.json(uniqueDiagnoses);
});

app.get('/api/random-forest/interventions', (req, res) => {
    res.json(uniqueInterventions);
});

// Predicción de supervivencia
app.post('/api/random-forest/predict', (req, res) => {
    const { dx, intervencion, cantidad, tarifa } = req.body;
    
    if (!dx || !intervencion) {
        return res.status(400).json({ error: 'Faltan campos requeridos: dx e intervencion.' });
    }

    try {
        const prediction = rf.predict(dx, intervencion, cantidad, tarifa);
        res.json(prediction);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Detective (NLP mediante Expresiones Regulares)
app.post('/api/random-forest/detective', (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Falta el texto clínico para analizar.' });
    }

    // Expresión regular para raíces clave: morir, óbito, fallecimiento, fallecer, defunción, deceso, finado, cadáver, difunto, etc.
    const regex = /^(morir|murió|murieron|muere|mueren|muerto|muerta|muertes|muerte|óbito|óbitos|fallecer|falleció|fallecieron|fallece|fallecen|fallecido|fallecida|fallecidos|fallecidas|fallecimiento|fallecimientos|defunción|defunciones|deceso|decesos|decesó|finado|finada|finados|finadas|cadáver|cadáveres|difunto|difunta|difuntos|difuntas|mortuorio|mortuoria|autopsia|autopsias|parocardiorrespiratorio)$/i;
    
    const matches = [];
    const words = text.split(/[\s,.:;?!\(\)"'\r\n]+/);
    
    words.forEach(word => {
        // Normalizar palabra para quitar signos y mantener letras/acentos
        const cleaned = word.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "");
        if (cleaned) {
            if (regex.test(cleaned)) {
                if (!matches.includes(cleaned)) {
                    matches.push(cleaned);
                }
            }
        }
    });

    const detected = matches.length > 0;

    res.json({
        text,
        detected,
        matches,
        verdict: detected ? "Mortalidad Detectada" : "Mortalidad No Detectada"
    });
});

// Listado paginado de pacientes
app.get('/api/random-forest/patients', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const mortalidadFilter = req.query.mortalidad || 'all'; // 'all', '1' (muerto), '0' (vivo)
    
    const offset = (page - 1) * limit;

    try {
        let sqlWhere = "WHERE 1=1";
        const params = [];

        if (search) {
            sqlWhere += " AND (nombre LIKE ? OR appat LIKE ? OR apmat LIKE ? OR dx LIKE ?)";
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (mortalidadFilter === '1' || mortalidadFilter === '0') {
            sqlWhere += " AND mortalidad = ?";
            params.push(parseInt(mortalidadFilter));
        }

        const countSql = `SELECT COUNT(*) as count FROM registro_a ${sqlWhere};`;
        const totalCountRow = await db.query.get(countSql, params);
        const total = totalCountRow.count;

        const dataSql = `SELECT id_a, nombre, appat, apmat, edad, genero, dx, resclin, intervencion, cantidad, tarifa, mortalidad 
                         FROM registro_a 
                         ${sqlWhere} 
                         ORDER BY id_a DESC 
                         LIMIT ? OFFSET ?;`;
        
        const pageParams = [...params, limit, offset];
        const patients = await db.query.all(dataSql, pageParams);

        res.json({
            patients,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar mortalidad de un paciente (lógica Detective en lote / unitaria)
app.post('/api/random-forest/patients/update-mortality', async (req, res) => {
    const { id_a, mortalidad } = req.body;
    if (id_a === undefined || mortalidad === undefined) {
        return res.status(400).json({ error: 'Faltan id_a y mortalidad.' });
    }

    try {
        await db.query.run("UPDATE registro_a SET mortalidad = ? WHERE id_a = ?;", [mortalidad, id_a]);
        res.json({ success: true, message: `Paciente ${id_a} actualizado con mortalidad = ${mortalidad}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ejecutar Detective NLP en toda la base de datos (lote masivo)
app.post('/api/random-forest/detective/run-all', async (req, res) => {
    try {
        console.log("Iniciando escaneo masivo del Detective NLP en SQLite...");
        const rows = await db.query.all("SELECT id_a, resclin, mortalidad FROM registro_a;");
        const total = rows.length;
        
        // Expresión regular para raíces clave
        const regex = /^(morir|murió|murieron|muere|mueren|muerto|muerta|muertes|muerte|óbito|óbitos|fallecer|falleció|fallecieron|fallece|fallecen|fallecido|fallecida|fallecidos|fallecidas|fallecimiento|fallecimientos|defunción|defunciones|deceso|decesos|decesó|finado|finada|finados|finadas|cadáver|cadáveres|difunto|difunta|difuntos|difuntas|mortuorio|mortuoria|autopsia|autopsias|parocardiorrespiratorio)$/i;

        let updatedCount = 0;
        const updates = [];

        for (const row of rows) {
            const text = row.resclin || "";
            const words = text.split(/[\s,.:;?!\(\)"'\r\n]+/);
            let detected = false;
            
            for (const word of words) {
                const cleaned = word.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "");
                if (cleaned && regex.test(cleaned)) {
                    detected = true;
                    break;
                }
            }

            const newMortalidad = detected ? 1 : 0;
            if (newMortalidad !== row.mortalidad) {
                updates.push({ id_a: row.id_a, mortalidad: newMortalidad });
            }
        }

        if (updates.length > 0) {
            console.log(`Aplicando ${updates.length} actualizaciones en la base de datos...`);
            await db.query.run("BEGIN TRANSACTION;");
            const stmt = db.db.prepare("UPDATE registro_a SET mortalidad = ? WHERE id_a = ?;");
            for (const update of updates) {
                stmt.run(update.mortalidad, update.id_a);
            }
            stmt.finalize();
            await db.query.run("COMMIT;");
        }

        res.json({
            success: true,
            totalScanned: total,
            totalUpdated: updates.length,
            message: `Se escanearon ${total} registros clínicos. Se corrigieron y actualizaron ${updates.length} registros.`
        });
    } catch (error) {
        console.error("Error al ejecutar Detective masivo:", error);
        res.status(500).json({ error: error.message });
    }
});

// Reentrenar clasificador de Random Forest
app.post('/api/random-forest/model/train', (req, res) => {
    const { exec } = require('child_process');
    console.log("Iniciando reentrenamiento del modelo Random Forest...");
    
    // Ruta al ejecutable de python del entorno virtual
    const pythonPath = path.join(__dirname, '.venv', 'bin', 'python');
    const trainScriptPath = path.join(__dirname, 'scripts', 'train_rf.py');

    exec(`"${pythonPath}" "${trainScriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error al entrenar el modelo: ${error}`);
            return res.status(500).json({ error: error.message, stderr });
        }
        
        console.log(`Salida del script de entrenamiento:\n${stdout}`);
        
        // Recargar el modelo recién guardado en memoria
        rf.loadModel();

        res.json({
            success: true,
            stdout,
            message: "El modelo Random Forest se ha reentrenado y exportado exitosamente."
        });
    });
});


// ----------------------------------------------------
// HELPERS REGRESION MATEMATICA
// ----------------------------------------------------

function calculateRegression(rows, xField, yField) {
    const n = rows.length;
    if (n < 2) return { b0: 0, b1: 0, r2: 0 };

    const x = rows.map(r => parseFloat(r[xField]) || 0);
    const y = rows.map(r => parseFloat(r[yField]) || 0);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const promX = sumX / n;
    const promY = sumY / n;

    let sumMinusProm = 0.0;
    let sumXMinusPromX2 = 0.0;
    let sumYMinusPromY2 = 0.0;

    for (let i = 0; i < n; i++) {
        const dx = x[i] - promX;
        const dy = y[i] - promY;
        sumMinusProm += dx * dy;
        sumXMinusPromX2 += dx * dx;
        sumYMinusPromY2 += dy * dy;
    }

    const b1 = sumXMinusPromX2 === 0 ? 0 : sumMinusProm / sumXMinusPromX2;
    const b0 = promY - b1 * promX;

    // Calcular R2 (coeficiente de determinación)
    let r2 = 0;
    if (sumXMinusPromX2 !== 0 && sumYMinusPromY2 !== 0) {
        r2 = (sumMinusProm * sumMinusProm) / (sumXMinusPromX2 * sumYMinusPromY2);
    }

    return { b0, b1, r2 };
}

// ----------------------------------------------------
// ENDPOINTS: REGRESION LINEAL 1 (Inversiones vs Ventas)
// ----------------------------------------------------

app.get('/api/regresion-1/data', async (req, res) => {
    try {
        const data = await db.query.all("SELECT mes, inversion, ventas FROM reportes ORDER BY mes ASC;");
        const model = calculateRegression(data, 'inversion', 'ventas');
        res.json({ data, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/regresion-1/predict', async (req, res) => {
    try {
        const data = await db.query.all("SELECT mes, inversion, ventas FROM reportes ORDER BY mes ASC;");
        const n = data.length;
        if (n < 2) {
            return res.status(400).json({ error: 'Se necesitan al menos 2 registros para la progresión de inversiones.' });
        }

        // Obtener inversiones de los primeros meses para la progresión uniforme
        const firstInversion = data[0].inversion;
        const secondInversion = data[1].inversion;
        const diff = secondInversion - firstInversion;

        // Inversión por sucesión aritmética para el mes siguiente (mes N + 1)
        const nextInversion = diff * n + firstInversion;

        // Calcular la regresión actual
        const { b0, b1 } = calculateRegression(data, 'inversion', 'ventas');
        
        // Estimar ventas
        const estimatedSales = b0 + b1 * nextInversion;
        const nextMonth = n + 1;

        // Insertar en la base de datos
        await db.query.run("INSERT INTO reportes (mes, inversion, ventas) VALUES (?, ?, ?);", [nextMonth, nextInversion, estimatedSales]);
        
        // Obtener datos actualizados
        const updatedData = await db.query.all("SELECT mes, inversion, ventas FROM reportes ORDER BY mes ASC;");
        const updatedModel = calculateRegression(updatedData, 'inversion', 'ventas');

        res.json({
            success: true,
            predicted: {
                mes: nextMonth,
                inversion: nextInversion,
                ventas: estimatedSales
            },
            data: updatedData,
            model: updatedModel
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/regresion-1/add', async (req, res) => {
    const { mes, inversion, ventas } = req.body;
    if (mes === undefined || inversion === undefined || ventas === undefined) {
        return res.status(400).json({ error: 'Faltan mes, inversion o ventas.' });
    }
    try {
        await db.query.run("INSERT OR REPLACE INTO reportes (mes, inversion, ventas) VALUES (?, ?, ?);", [parseInt(mes), parseFloat(inversion), parseFloat(ventas)]);
        const data = await db.query.all("SELECT mes, inversion, ventas FROM reportes ORDER BY mes ASC;");
        const model = calculateRegression(data, 'inversion', 'ventas');
        res.json({ success: true, data, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/regresion-1/reset', async (req, res) => {
    try {
        await db.resetTable('reportes');
        const data = await db.query.all("SELECT mes, inversion, ventas FROM reportes ORDER BY mes ASC;");
        const model = calculateRegression(data, 'inversion', 'ventas');
        res.json({ success: true, data, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----------------------------------------------------
// ENDPOINTS: REGRESION LINEAL 2 - EJERCICIO 1 (Repartidores)
// ----------------------------------------------------

app.get('/api/regresion-2-1/data', async (req, res) => {
    try {
        const data = await db.query.all("SELECT id, distancia, tiempo FROM repartidores ORDER BY id ASC;");
        const model = calculateRegression(data, 'distancia', 'tiempo');
        res.json({ data, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/regresion-2-1/predict', async (req, res) => {
    const { distancia } = req.body;
    if (distancia === undefined) {
        return res.status(400).json({ error: 'Falta el parámetro distancia.' });
    }
    try {
        const data = await db.query.all("SELECT id, distancia, tiempo FROM repartidores ORDER BY id ASC;");
        const { b0, b1, r2 } = calculateRegression(data, 'distancia', 'tiempo');
        const d = parseFloat(distancia);
        const estimatedTime = b0 + b1 * d;
        res.json({
            distancia: d,
            tiempo_estimado: estimatedTime,
            model: { b0, b1, r2 }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/regresion-2-1/add', async (req, res) => {
    const { distancia, tiempo } = req.body;
    if (distancia === undefined || tiempo === undefined) {
        return res.status(400).json({ error: 'Faltan distancia y tiempo.' });
    }
    try {
        await db.query.run("INSERT INTO repartidores (distancia, tiempo) VALUES (?, ?);", [parseFloat(distancia), parseFloat(tiempo)]);
        const data = await db.query.all("SELECT id, distancia, tiempo FROM repartidores ORDER BY id ASC;");
        const model = calculateRegression(data, 'distancia', 'tiempo');
        res.json({ success: true, data, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/regresion-2-1/reset', async (req, res) => {
    try {
        await db.resetTable('repartidores');
        const data = await db.query.all("SELECT id, distancia, tiempo FROM repartidores ORDER BY id ASC;");
        const model = calculateRegression(data, 'distancia', 'tiempo');
        res.json({ success: true, data, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ----------------------------------------------------
// ENDPOINTS: REGRESION LINEAL 2 - EJERCICIO 2 (Históricos de Backup)
// ----------------------------------------------------

app.get('/api/regresion-2-2/data', async (req, res) => {
    try {
        const data = await db.query.all("SELECT id, usuarios, backup FROM historicos ORDER BY id ASC;");
        const model = calculateRegression(data, 'usuarios', 'backup');
        res.json({ data, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/regresion-2-2/predict', async (req, res) => {
    const { usuarios } = req.body;
    if (usuarios === undefined) {
        return res.status(400).json({ error: 'Falta el parámetro usuarios.' });
    }
    try {
        const data = await db.query.all("SELECT id, usuarios, backup FROM historicos ORDER BY id ASC;");
        const { b0, b1, r2 } = calculateRegression(data, 'usuarios', 'backup');
        const u = parseFloat(usuarios);
        const estimatedBackup = b0 + b1 * u;
        res.json({
            usuarios: u,
            backup_estimado: estimatedBackup,
            model: { b0, b1, r2 }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/regresion-2-2/add', async (req, res) => {
    const { usuarios, backup } = req.body;
    if (usuarios === undefined || backup === undefined) {
        return res.status(400).json({ error: 'Faltan usuarios y backup.' });
    }
    try {
        await db.query.run("INSERT INTO historicos (usuarios, backup) VALUES (?, ?);", [parseFloat(usuarios), parseFloat(backup)]);
        const data = await db.query.all("SELECT id, usuarios, backup FROM historicos ORDER BY id ASC;");
        const model = calculateRegression(data, 'usuarios', 'backup');
        res.json({ success: true, data, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/regresion-2-2/reset', async (req, res) => {
    try {
        await db.resetTable('historicos');
        const data = await db.query.all("SELECT id, usuarios, backup FROM historicos ORDER BY id ASC;");
        const model = calculateRegression(data, 'usuarios', 'backup');
        res.json({ success: true, data, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Iniciar el servidor
app.listen(PORT, async () => {
    console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
    await loadAutocompleteCache();
});
