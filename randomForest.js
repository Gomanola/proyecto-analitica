const fs = require('fs');
const path = require('path');

class RandomForestPredictor {
    constructor() {
        this.model = null;
        this.loadModel();
    }

    loadModel() {
        try {
            const modelPath = path.join(__dirname, 'rf_model.json');
            if (fs.existsSync(modelPath)) {
                console.log(`Cargando modelo Random Forest desde: ${modelPath}`);
                const rawData = fs.readFileSync(modelPath, 'utf8');
                this.model = JSON.parse(rawData);
                console.log(`Modelo cargado exitosamente. Árboles: ${this.model.trees.length}`);
            } else {
                console.error(`Error: No se encontró el archivo del modelo en ${modelPath}. Corre scripts/train_rf.py primero.`);
            }
        } catch (error) {
            console.error('Error al cargar el modelo Random Forest:', error);
        }
    }

    // Codifica un texto buscando coincidencia exacta o insensible a mayúsculas
    encodeString(val, classes) {
        if (!val) return 0;
        const target = val.trim().toLowerCase();
        
        // Buscar coincidencia insensible a mayúsculas/minúsculas
        const idx = classes.findIndex(c => c.toLowerCase() === target);
        if (idx !== -1) return idx;
        
        // Si no se encuentra, retornar el índice 0 como fallback por defecto
        return 0;
    }

    // Recorre un árbol de decisión de forma recursiva
    predictTree(tree, nodeIdx, features) {
        const left = tree.children_left[nodeIdx];
        const right = tree.children_right[nodeIdx];
        
        // Si es una hoja (no tiene hijos izquierdos)
        if (left === -1) {
            const val = tree.value[nodeIdx][0]; // Formato: [count_clase_0, count_clase_1]
            const sum = val.reduce((a, b) => a + b, 0);
            return val.map(v => v / (sum || 1));
        }

        const featureIdx = tree.feature[nodeIdx];
        const threshold = tree.threshold[nodeIdx];
        const val = features[featureIdx];

        if (val <= threshold) {
            return this.predictTree(tree, left, features);
        } else {
            return this.predictTree(tree, right, features);
        }
    }

    // Predicción del bosque completo
    predict(dx, intervencion, cantidad, tarifa) {
        if (!this.model) {
            throw new Error('El modelo Random Forest no está cargado.');
        }

        // Codificar los inputs
        const dxEncoded = this.encodeString(dx, this.model.dx_classes);
        const intEncoded = this.encodeString(intervencion, this.model.intervencion_classes);
        
        // Convertir cantidad y tarifa a números
        const qty = parseFloat(cantidad) || 0;
        const rate = parseFloat(tarifa) || 0;

        // Vector de características en el orden en que fue entrenado: ['dx', 'intervencion', 'cantidad', 'tarifa']
        const features = [dxEncoded, intEncoded, qty, rate];

        let sumProbs = [0, 0];
        const numTrees = this.model.trees.length;

        for (let i = 0; i < numTrees; i++) {
            const probs = this.predictTree(this.model.trees[i], 0, features);
            sumProbs[0] += probs[0];
            sumProbs[1] += probs[1];
        }

        // Calcular promedio de probabilidades
        const avgProbs = sumProbs.map(p => p / numTrees);
        
        // Clase predicha: 1 (Fallece) si prob >= 0.5, de lo contrario 0 (Sobrevive)
        const predictedClass = avgProbs[1] >= 0.5 ? 1 : 0;

        return {
            dx: dx,
            dx_encoded: dxEncoded,
            intervencion: intervencion,
            intervencion_encoded: intEncoded,
            cantidad: qty,
            tarifa: rate,
            mortalidad_probabilidad: avgProbs[1],
            sobrevivencia_probabilidad: avgProbs[0],
            prediccion: predictedClass,
            prediccion_texto: predictedClass === 1 ? 'Fallecimiento' : 'Sobrevivencia'
        };
    }
}

module.exports = new RandomForestPredictor();
