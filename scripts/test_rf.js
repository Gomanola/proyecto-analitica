const rf = require('../randomForest.js');

try {
    console.log("Testeando predicciones con casos clínicos...");
    
    // Test Caso 1: Caso de sobreviviente esperado
    // DX: "NEUMONIA NO ESPECIFICADA", INTERVENCION: "URGENCIAS", CANTIDAD: 1, TARIFA: 1000
    const result1 = rf.predict("NEUMONIA NO ESPECIFICADA", "URGENCIAS", 1, 1000);
    console.log("\nCaso 1 - Neumonía leve:");
    console.log(JSON.stringify(result1, null, 2));

    // Test Caso 2: Caso de mortalidad esperada (paciente crítico)
    // DX: "COVID-19", INTERVENCION: "TERAPIA INTENSIVA", CANTIDAD: 10, TARIFA: 150000
    const result2 = rf.predict("COVID-19", "TERAPIA INTENSIVA", 10, 150000);
    console.log("\nCaso 2 - COVID Crítico:");
    console.log(JSON.stringify(result2, null, 2));

    console.log("\n¡Prueba exitosa!");
} catch (e) {
    console.error("Error en la prueba:", e);
}
