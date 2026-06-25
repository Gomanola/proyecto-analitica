import sqlite3
import pandas as pd
import numpy as np
import json
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import cross_val_score

# Rutas de archivos
workspace_dir = "/home/alexis/Documentos/Carrera/8vo Semestre/Analítica de Datos/Parcial 3/Proyecto Final"
sqlite_db_path = os.path.join(workspace_dir, "Proyecto", "proyecto.db")
json_model_path = os.path.join(workspace_dir, "Proyecto", "rf_model.json")

print("--- Entrenando y Exportando Modelo Random Forest ---")

# 1. Cargar datos desde SQLite
if not os.path.exists(sqlite_db_path):
    print(f"Error: No se encontró la base de datos SQLite en: {sqlite_db_path}")
    exit(1)

print("Conectando a la base de datos SQLite...")
conn = sqlite3.connect(sqlite_db_path)

print("Extrayendo datos de registro_a...")
query = """
SELECT dx, intervencion, cantidad, tarifa, mortalidad
FROM registro_a
WHERE mortalidad IS NOT NULL
"""
df = pd.read_sql(query, conn)
conn.close()

if df.empty:
    print("Error: No hay datos disponibles para entrenar el modelo.")
    exit(1)

print(f"Datos cargados: {len(df)} registros.")

# 2. Preprocesar datos con LabelEncoder
print("Codificando variables de texto...")
traductores = {}
columnas_texto = ['dx', 'intervencion']

for col in columnas_texto:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col].astype(str))
    traductores[col] = le

# Variables independientes (X) y dependiente (y)
X = df[['dx', 'intervencion', 'cantidad', 'tarifa']]
y = df['mortalidad']

# 3. Evaluar modelo con Cross-Validation (5 folds)
print("Haciendo validación cruzada (5 simulacros)...")
rf = RandomForestClassifier(n_estimators=50, max_depth=12, min_samples_leaf=10, random_state=42, class_weight='balanced')
calificaciones = cross_val_score(rf, X, y, cv=5)
print(f"Calificaciones individuales de los 5 exámenes: {calificaciones}")
print(f"Promedio general de precisión: {(calificaciones.mean() * 100):.2f}%")

# 4. Entrenar el modelo final
print("Entrenando modelo definitivo con el 100% de los datos...")
rf.fit(X, y)
print("¡Entrenamiento completado!")

# 5. Exportar el modelo a JSON
print("Exportando estructura del modelo a JSON...")

def exportar_arbol(tree_structure):
    # La estructura del árbol de scikit-learn contiene arreglos numpy
    # que debemos convertir a listas de Python estándar
    return {
        "children_left": tree_structure.children_left.tolist(),
        "children_right": tree_structure.children_right.tolist(),
        "feature": tree_structure.feature.tolist(),
        "threshold": tree_structure.threshold.tolist(),
        "value": tree_structure.value.tolist() # Lista de listas con conteos de clase
    }

# Extraer todos los estimadores (los 50 árboles de decisión)
trees_json = [exportar_arbol(estimator.tree_) for estimator in rf.estimators_]

# Armar el payload final del modelo
model_payload = {
    "n_features": rf.n_features_in_,
    "classes": rf.classes_.tolist(),
    "feature_names": ['dx', 'intervencion', 'cantidad', 'tarifa'],
    "dx_classes": traductores['dx'].classes_.tolist(),
    "intervencion_classes": traductores['intervencion'].classes_.tolist(),
    "trees": trees_json
}

print(f"Guardando archivo JSON en: {json_model_path}")
with open(json_model_path, "w", encoding="utf-8") as f:
    json.dump(model_payload, f)

print(f"¡Modelo exportado con éxito! Tamaño del archivo JSON: {os.path.getsize(json_model_path) / 1024 / 1024:.2f} MB")
