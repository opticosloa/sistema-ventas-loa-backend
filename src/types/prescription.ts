// Define la interfaz para datos genéricos de recetas (Legacy/Vision parsing)
export interface PrescriptionData {
  centro?: string;
  paciente?: { nombre: string };
  obraSocial?: string;
  numeroObraSocial?: string;
  prescripcion?: {
    OD?: { esfera?: string; cilindro?: string; eje?: string };
    OI?: { esfera?: string; cilindro?: string; eje?: string };
  };
  fecha?: string;
  otrosDatos?: { [key: string]: string }; // Para datos adicionales no estructurados
}

// Updated Prescription Interface matching new DB Schema
export interface Prescription {
  prescripcion_id?: string;
  cliente_id: string;
  doctor_id: string;
  fecha: Date | string;
  lejos?: Record<string, any>; // jsonb
  cerca?: Record<string, any>; // jsonb
  multifocal?: Record<string, any>; // jsonb
  observaciones?: string;
  obraSocial?: string;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
  image_url: string;
}

export interface PrescriptionProduct {
  prescripcion_producto_id?: string;
  prescripcion_id: string;
  producto_id: string;
  created_at?: Date;
}