import { PrescriptionData } from "../types/prescription";

export function parsePrescription(text: string): PrescriptionData {
  const result: PrescriptionData = {};
  const lines = text.split('\n').map(line => line.trim().toLowerCase());

  // Extraer centro (líneas con títulos profesionales o instituciones, evitando fragmentos sueltos)
  const centroLines = lines.filter(line =>
    (line.includes('dra.') || line.includes('dr.') || line.includes('médica') || line.includes('oftalmología') || line.includes('hospital')) &&
    line.length > 10 // Filtra fragmentos cortos
  );
  if (centroLines.length > 0) {
    result.centro = centroLines
      .join(' ')
      .replace(/(dra\.|dr\.)\s*/i, '$1 ')
      .replace(/ica clvil/, 'ex-médica civil') // Corrección manual aproximada
      .replace(/tar central/, 'hospital central')
      .trim();
  }

  // Extraer nombre del paciente (línea con nombre completo, priorizando líneas con dos palabras)
  const patientLine = lines.find(line => /[a-z]+ [a-z]+/.test(line) && !line.includes('dra.') && !line.includes('dr.') && line.length > 5);
  if (patientLine) {
    result.paciente = { nombre: patientLine.trim() || 'Desconocido' };
  }

  // Extraer obra social (líneas con abreviaturas comunes)
  const obraSocialLine = lines.find(line => /(smg|osde|galeno|swiss|medife)/i.test(line));
  if (obraSocialLine) {
    result.obraSocial = obraSocialLine.match(/(smg|osde|galeno|swiss|medife)/i)?.[0] || 'No especificada';
  }

  // Extraer número de obra social (líneas con números largos, priorizando secuencias completas)
  const numeroObraSocialLine = lines.find(line => /\d{3,}\s*\d{6,}/.test(line));
  if (numeroObraSocialLine) {
    result.numeroObraSocial = numeroObraSocialLine.match(/\d{3,}\s*\d{6,}/)?.[0].replace(/\s+/g, '') || 'No especificado';
  }

  // Extraer prescripción OD (formato pre-establecido)
  const odMatch = lines.find(line => {
    return /od\s*(?:-|\sesf-)\s*[-+]?[0-7](\.\d{1,2})?\s*(?:-|\scil\s*-)\s*[-+]?[0-7](\.\d{1,2})?\s*x\s*[0-180]°?/.test(line);
  });
  if (odMatch) {
    const [, esfera, , cilindro, , eje] = odMatch.match(/od\s*(?:-|\sesf-)\s*([-+]?[0-7](\.\d{1,2})?)\s*(?:-|\scil\s*-)\s*([-+]?[0-7](\.\d{1,2})?)\s*x\s*([0-180]°?)/i) || [];
    if (esfera && cilindro && eje) {
      result.prescripcion = result.prescripcion || {};
      result.prescripcion.OD = { esfera, cilindro, eje };
    }
  }

  // Extraer prescripción OI (formato pre-establecido)
  const oiMatch = lines.find(line => {
    return /oi\s*(?:-|\sesf-)\s*[-+]?[0-7](\.\d{1,2})?\s*(?:-|\scil\s*-)\s*[-+]?[0-7](\.\d{1,2})?\s*x\s*[0-180]°?/.test(line);
  });
  if (oiMatch) {
    const [, esfera, , cilindro, , eje] = oiMatch.match(/oi\s*(?:-|\sesf-)\s*([-+]?[0-7](\.\d{1,2})?)\s*(?:-|\scil\s*-)\s*([-+]?[0-7](\.\d{1,2})?)\s*x\s*([0-180]°?)/i) || [];
    if (esfera && cilindro && eje) {
      result.prescripcion = result.prescripcion || {};
      result.prescripcion.OI = { esfera, cilindro, eje };
    }
  }

  // Extraer fecha (patrón flexible para DD/MM/YY o DD-MM-YYYY)
  const dateMatch = lines.find(line => /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(line));
  if (dateMatch) {
    result.fecha = dateMatch;
  }

  // Capturar otros datos no estructurados (excluyendo líneas ya procesadas)
  const processedLines = [
    result.centro || '',
    result.paciente?.nombre || '',
    result.obraSocial || '',
    result.numeroObraSocial || '',
    result.fecha || '',
    odMatch || '',
    oiMatch || ''
  ].join(' ');
  const otherData = lines.filter(line => !processedLines.includes(line) && line.length > 2);
  if (otherData.length > 0) {
    result.otrosDatos = otherData.reduce((acc, line) => {
      const [key, value] = line.split(':').map(s => s.trim()) || [line, ''];
      if (typeof key !== 'undefined' && key !== '') {
        acc[key] = value || line;
      }
      return acc;
    }, {} as { [key: string]: string });
  }

  return result;
}