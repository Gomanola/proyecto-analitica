const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'proyecto.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al abrir la base de datos:', err.message);
    } else {
        console.log('Conectado exitosamente a la base de datos SQLite unificada.');
    }
});

// Promisificar las llamadas a la base de datos
const query = {
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    },
    exec: (sql) => {
        return new Promise((resolve, reject) => {
            db.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
};

// Datos iniciales para restaurar base de datos
const defaultData = {
    reportes: [
        [1, 32.5, 120.5],
        [2, 38.1, 141.2],
        [3, 45.0, 165.0],
        [4, 52.3, 191.0],
        [5, 60.1, 220.3],
        [6, 68.5, 251.0],
        [7, 77.4, 283.4],
        [8, 87.0, 318.0]
    ],
    repartidores: [
        [1, 1.0, 15.0],
        [2, 2.0, 25.0],
        [3, 3.0, 35.0],
        [4, 4.0, 42.0],
        [5, 5.0, 55.0]
    ],
    historicos: [
        [1, 100.0, 50.0],
        [2, 200.0, 90.0],
        [3, 300.0, 120.0],
        [4, 400.0, 160.0]
    ]
};

async function resetTable(tableName) {
    if (tableName === 'reportes') {
        await query.run(`DROP TABLE IF EXISTS reportes;`);
        await query.run(`CREATE TABLE reportes (
            mes INTEGER PRIMARY KEY,
            inversion REAL,
            ventas REAL
        );`);
        for (const row of defaultData.reportes) {
            await query.run(`INSERT INTO reportes (mes, inversion, ventas) VALUES (?, ?, ?);`, row);
        }
    } else if (tableName === 'repartidores') {
        await query.run(`DROP TABLE IF EXISTS repartidores;`);
        await query.run(`CREATE TABLE repartidores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            distancia REAL,
            tiempo REAL
        );`);
        for (const row of defaultData.repartidores) {
            await query.run(`INSERT INTO repartidores (id, distancia, tiempo) VALUES (?, ?, ?);`, row);
        }
    } else if (tableName === 'historicos') {
        await query.run(`DROP TABLE IF EXISTS historicos;`);
        await query.run(`CREATE TABLE historicos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuarios REAL,
            backup REAL
        );`);
        for (const row of defaultData.historicos) {
            await query.run(`INSERT INTO historicos (id, usuarios, backup) VALUES (?, ?, ?);`, row);
        }
    }
}

module.exports = {
    query,
    resetTable,
    db
};
