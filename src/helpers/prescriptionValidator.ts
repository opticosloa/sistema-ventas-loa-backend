

export class PrescriptionValidator {
    private static instance: PrescriptionValidator;

    private constructor() { }

    public static getInstance(): PrescriptionValidator {
        if (!PrescriptionValidator.instance) {
            PrescriptionValidator.instance = new PrescriptionValidator();
        }
        return PrescriptionValidator.instance;
    }

    /**
     * Valida una receta completa (texto parseado por OCR o ingresado manualmente)
     */
    public validatePrescription(data: any) {
        const errors: string[] = [];

        if (!data) return { valid: false, errors: ["Datos vacíos"] };

        if (!data.cliente_id && !data.cliente) {
            errors.push('Debe enviarse cliente_id o datos de cliente');
        }

        if (data.cliente) {
            if (!data.cliente.nombre) errors.push('Nombre de cliente requerido');
            if (!data.cliente.apellido) errors.push('Apellido de cliente requerido');
            if (!data.cliente.dni) errors.push('DNI de cliente requerido');
        }


        // Validar fecha
        if (data.fecha && !this.validateDate(data.fecha)) {
            // Aceptamos Date object también si viene casteado, pero si es string debe cumplir formato
            if (typeof data.fecha === 'string' && !this.validateDate(data.fecha)) {
                errors.push("La fecha no tiene un formato válido (DD/MM/YYYY o YYYY-MM-DD)");
            }
        }

        const sections = ['lejos', 'cerca', 'multifocal'];
        let hasContent = false;

        sections.forEach(section => {
            if (data[section]) {
                hasContent = true;
                const { od, oi } = data[section];

                // Si la sección existe, debe tener al menos un ojo o estructura válida si es opcional?
                // Asumimos que si la sección está, validamos lo que haya.

                if (od) {
                    const odValidation = this.validateEye(`${section.toUpperCase()} - OD`, od);
                    if (!odValidation.valid) errors.push(...odValidation.errors);
                }

                if (oi) {
                    const oiValidation = this.validateEye(`${section.toUpperCase()} - OI`, oi);
                    if (!oiValidation.valid) errors.push(...oiValidation.errors);
                }
            }
        });

        // Soporte Legacy (si viene 'prescripcion' con OD/OI directo en la raíz o dentro de prescripcion)
        if (!hasContent && data.prescripcion) {
            const { OD, OI } = data.prescripcion;
            if (OD) {
                const odVal = this.validateEye("Legacy OD", OD);
                if (!odVal.valid) errors.push(...odVal.errors);
            }
            if (OI) {
                const oiVal = this.validateEye("Legacy OI", OI);
                if (!oiVal.valid) errors.push(...oiVal.errors);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Valida los datos de un ojo (OD u OI)
     */
    private validateEye(label: string, eyeData: any) {
        const errors: string[] = [];

        if (!eyeData) {
            errors.push(`${label} no está presente`);
            return { valid: false, errors };
        }

        const { esfera, cilindro, eje } = eyeData;

        // Validar esfera
        if (!this.isNumber(esfera)) {
            errors.push(`${label}: esfera inválida (${esfera})`);
        } else if (Number(esfera) < -20 || Number(esfera) > +20) {
            errors.push(`${label}: esfera fuera de rango (-20 a +20)`);
        }

        // Validar cilindro
        if (!this.isNumber(cilindro)) {
            errors.push(`${label}: cilindro inválido (${cilindro})`);
        } else if (Number(cilindro) < -10 || Number(cilindro) > 0) {
            errors.push(`${label}: cilindro fuera de rango (0 a -10)`);
        }

        // Validar eje
        if (!this.isNumber(eje)) {
            errors.push(`${label}: eje inválido (${eje})`);
        } else if (Number(eje) < 0 || Number(eje) > 180) {
            errors.push(`${label}: eje fuera de rango (0° a 180°)`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Verifica si un valor puede ser interpretado como número
     */
    private isNumber(value: any): boolean {
        if (value === null || value === undefined) return false;
        return !isNaN(Number(value));
    }

    /**
     * Valida fechas DD/MM/YYYY o YYYY-MM-DD
     */
    private validateDate(dateStr: string) {
        const regex1 = /^\d{2}\/\d{2}\/\d{4}$/; // DD/MM/YYYY
        const regex2 = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

        return regex1.test(dateStr) || regex2.test(dateStr);
    }
}
