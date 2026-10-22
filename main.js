import express from 'express';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';
import indexRoutes from './router/routes.js';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import db, { ensureSprint1Schema } from "./database/db.js";

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
// Mostrar la diferencia entre las dos formas de concatenar rutas
// console.log(__dirname, '/views');
// console.log(join(__dirname, 'views'));
//==========================================
// CONFIGURACIÓN DE EJS
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
// Carpeta de archivos estaticos
app.use(express.static(join(__dirname, 'public')));
//==========================================
// CONFIGURACIÓN DE SESSION Y FLASH
app.use(cookieParser());
//==========================================
app.use(morgan('dev'));
//=========================================
// DECODIFICADOR DE BODY
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// MANEJADOR DE BETTER-AUTH
app.all('/api/auth/{*any}', toNodeHandler(auth));
// ENRUTADOR
app.use(indexRoutes);
const port = Number(process.env.PORT || 3000);

try {
  await ensureSprint1Schema();
  app.listen(port);
  console.log('Server on port', port);
  console.log(`http://localhost:${port}/`);
} catch (error) {
  console.error("No se pudo preparar el esquema de la base de datos:", error);
  await db.pool.end();
  process.exitCode = 1;
}