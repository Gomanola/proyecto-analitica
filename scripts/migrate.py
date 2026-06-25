import sqlite3
import mysql.connector
import os
import re

# Configuración de base de datos MySQL local
mysql_config = {
    'user': 'alexis', 
    'password': '1783',
    'host': 'localhost',
    'database': 'covid_19pruebas'
}

# Rutas de archivos
workspace_dir = "/home/alexis/Documentos/Carrera/8vo Semestre/Analítica de Datos/Parcial 3/Proyecto Final"
sqlite_db_path = os.path.join(workspace_dir, "Proyecto", "proyecto.db")

print("--- Iniciando Migración de Base de Datos ---")

# 1. Crear/Conectar a SQLite
print(f"Creando/Conectando a base de datos SQLite unificada en: {sqlite_db_path}")
sqlite_conn = sqlite3.connect(sqlite_db_path)
sqlite_cursor = sqlite_conn.cursor()

# 2. Migrar registro_a desde MySQL
try:
    print("Conectando a la base de datos MySQL local...")
    mysql_conn = mysql.connector.connect(**mysql_config)
    mysql_cursor = mysql_conn.cursor(dictionary=True)
    
    print("Obteniendo información de la tabla registro_a...")
    # Crear la tabla en SQLite con el esquema adecuado
    sqlite_cursor.execute("DROP TABLE IF EXISTS registro_a;")
    
    # Creamos la estructura optimizada con las columnas realmente necesarias
    create_table_sql = """
    CREATE TABLE registro_a (
        id_a INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        appat TEXT,
        apmat TEXT,
        edad INTEGER,
        genero TEXT,
        dx TEXT,
        resclin TEXT,
        intervencion TEXT,
        cantidad INTEGER,
        tarifa INTEGER,
        mortalidad INTEGER DEFAULT 0
    );
    """
    sqlite_cursor.execute(create_table_sql)
    
    # Obtener registros de MySQL y cargarlos en SQLite en lotes
    print("Contando registros en MySQL...")
    mysql_cursor.execute("SELECT COUNT(*) FROM registro_a;")
    total_pacientes = mysql_cursor.fetchone()['COUNT(*)']
    print(f"Total de registros a migrar de registro_a: {total_pacientes}")
    
    batch_size = 5000
    offset = 0
    
    # Preparamos la consulta de inserción con columnas esenciales
    columns = [
        "id_a", "nombre", "appat", "apmat", "edad", "genero", "dx", "resclin", 
        "intervencion", "cantidad", "tarifa", "mortalidad"
    ]
    
    placeholders = ", ".join(["?" for _ in columns])
    insert_sql = f"INSERT INTO registro_a ({', '.join(columns)}) VALUES ({placeholders})"
    
    print("Migrando registro_a en lotes de 5000...")
    while offset < total_pacientes:
        # Obtenemos lote de MySQL
        mysql_cursor.execute(f"SELECT * FROM registro_a LIMIT {batch_size} OFFSET {offset}")
        rows = mysql_cursor.fetchall()
        
        # Mapeamos a tuplas ordenadas por columns
        batch_data = []
        for r in rows:
            row_data = tuple(r.get(col) for col in columns)
            batch_data.append(row_data)
            
        # Insertamos en SQLite
        sqlite_cursor.executemany(insert_sql, batch_data)
        sqlite_conn.commit()
        
        offset += len(rows)
        print(f"Progreso: {offset}/{total_pacientes} registros migrados.")
        
    mysql_cursor.close()
    mysql_conn.close()
    print("¡Tabla registro_a migrada exitosamente!")
    
except mysql.connector.Error as err:
    print(f"Error al conectar con MySQL: {err}")
    print("No se pudo migrar registro_a desde MySQL. Asegúrate de que el servidor MySQL local esté corriendo.")

# 3. Migrar Regresión Lineal 1 (inversiones_ventas.sql)
rl1_sql_path = os.path.join(workspace_dir, "Regresión Lineal 1", "inversiones_ventas.sql")
if os.path.exists(rl1_sql_path):
    print("\nMigrando tabla reportes (Regresión Lineal 1)...")
    with open(rl1_sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()
    
    # Limpiamos algunas sentencias sqlite específicas que no aplican o pueden fallar
    sql_content = re.sub(r"PRAGMA foreign_keys=OFF;", "", sql_content)
    sql_content = re.sub(r"DELETE FROM sqlite_sequence;", "", sql_content)
    sql_content = re.sub(r"INSERT INTO sqlite_sequence.*", "", sql_content)
    
    sqlite_cursor.execute("DROP TABLE IF EXISTS reportes;")
    sqlite_cursor.executescript(sql_content)
    sqlite_conn.commit()
    print("¡Tabla reportes migrada exitosamente!")
else:
    print(f"\nAdvertencia: No se encontró {rl1_sql_path}")

# 4. Migrar Regresión Lineal 2 Ejercicio 1 (base_ejercicio1.sql)
rl2_ej1_sql_path = os.path.join(workspace_dir, "Regresión Lineal 2", "Ejercicio 1", "base_ejercicio1.sql")
if os.path.exists(rl2_ej1_sql_path):
    print("\nMigrando tabla repartidores (Regresión Lineal 2 - Ejercicio 1)...")
    with open(rl2_ej1_sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()
        
    sql_content = re.sub(r"PRAGMA foreign_keys=OFF;", "", sql_content)
    sql_content = re.sub(r"DELETE FROM sqlite_sequence;", "", sql_content)
    sql_content = re.sub(r"INSERT INTO sqlite_sequence.*", "", sql_content)
    
    sqlite_cursor.execute("DROP TABLE IF EXISTS repartidores;")
    sqlite_cursor.executescript(sql_content)
    sqlite_conn.commit()
    print("¡Tabla repartidores migrada exitosamente!")
else:
    print(f"\nAdvertencia: No se encontró {rl2_ej1_sql_path}")

# 5. Migrar Regresión Lineal 2 Ejercicio 2 (base_ejercicio2.sql)
rl2_ej2_sql_path = os.path.join(workspace_dir, "Regresión Lineal 2", "Ejercicio 2", "base_ejercicio2.sql")
if os.path.exists(rl2_ej2_sql_path):
    print("\nMigrando tabla historicos (Regresión Lineal 2 - Ejercicio 2)...")
    with open(rl2_ej2_sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()
        
    sql_content = re.sub(r"PRAGMA foreign_keys=OFF;", "", sql_content)
    sql_content = re.sub(r"DELETE FROM sqlite_sequence;", "", sql_content)
    sql_content = re.sub(r"INSERT INTO sqlite_sequence.*", "", sql_content)
    
    sqlite_cursor.execute("DROP TABLE IF EXISTS historicos;")
    sqlite_cursor.executescript(sql_content)
    sqlite_conn.commit()
    print("¡Tabla historicos migrada exitosamente!")
else:
    print(f"\nAdvertencia: No se encontró {rl2_ej2_sql_path}")

# Cerrar SQLite
sqlite_cursor.close()
sqlite_conn.close()

print("\n--- Migración Finalizada con Éxito ---")
