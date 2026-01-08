import express from 'express';
import cors from 'cors';
import multer from 'multer';
import vision from '@google-cloud/vision';

import cookieParser from 'cookie-parser';
import { AppRoutes } from './AppRoutes';
import { envs } from './helpers/envs';



const app = express();
app.use(cors({
  origin: [
    envs.FRONT_URL,
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));
app.use(express.json());
app.use(cookieParser());

// Configurar Google Vision Client
if (!envs.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
}
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: envs.GOOGLE_APPLICATION_CREDENTIALS as string,
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

const port = envs.PORT || 4000;
app.listen(port, () => {
  console.log('Server running on port:', port);
});