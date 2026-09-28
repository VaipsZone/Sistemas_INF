import express from 'express';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';
import indexRoutes from './router/routes.js';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

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
// DEFODIFICADOR DE BODY

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// ENRUTADOR
app.use(indexRoutes);
const port = Number(process.env.PORT || 3000);
app.listen(port);
console.log('Server on port', port);
console.log(`http://localhost:${port}/`);