import express from 'express';
import cors from 'cors';
import multer from 'multer';
import vision from '@google-cloud/vision';

import cookieParser from 'cookie-parser';
import { AppRoutes } from './AppRoutes';
import { envs } from './helpers/envs';
import { BranchSchedulerService } from './service';



const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'https://sistema-ventas-loa.vercel.app',
      'https://sistema-ventas-8u59txz1r-loas-projects-af7a680f.vercel.app',
      'https://sistemaloa.com',
      'https://www.sistemaloa.com',
    ];

    // permitir requests sin origin (Postman, cron, webhooks)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
// --- CONFIGURACIÓN DE LÍMITES DE PAYLOAD ---

// 1. Excepción: Límite extendido solo para Bulk Upsert (50MB)
// Nota: Asegúrate de que esta ruta coincida exactamente con la que usa tu API
app.use('/api/products/bulk-upsert', express.json({ limit: '60mb' }));
app.use('/api/products/bulk-upsert', express.urlencoded({ limit: '60mb', extended: true }));

// 2. Regla General: Límite estricto para todas las demás rutas (1MB)
// Esto protege tu servidor de ataques de saturación en el resto de los endpoints
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

app.use(cookieParser());

// Configurar Google Vision Client
if (!envs.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
}
const visionClient = new vision.ImageAnnotatorClient({
  credentials: JSON.parse(envs.GOOGLE_APPLICATION_CREDENTIALS as string),
});

// Configurar multer para usar memoria (buffer)
const upload = multer({
  storage: multer.memoryStorage(), // Asegura que usa buffer en memoria
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true); // Solo permite imágenes
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  },
});

// Directorio público
app.use(express.static('public'));

// Rutas
app.use(AppRoutes.routes);

const port = envs.PORT || 10000;
app.listen(port, () => {
  console.log('Server running on port:', port);
  BranchSchedulerService.getInstance().initScheduledJobs();
});

// Una ruta simple de bienvenida y estado
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'CRM LOA API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});