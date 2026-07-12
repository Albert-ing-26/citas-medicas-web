# Citas Medicas Web

Sistema web de reserva de citas medicas con 3 actores: Administrador, Medico y Paciente.

Stack: Node.js + Express + MySQL (phpMyAdmin) + EJS

## Estructura del proyecto

```
citas-medicas-web/
├── config/         # Conexion a la base de datos
├── middlewares/     # Autenticacion y control de roles
├── routes/          # Rutas por rol (auth, admin, medico, paciente)
├── views/            # Vistas EJS
├── public/            # CSS y JS del cliente
├── sql/                # Scripts de base de datos
├── server.js
├── package.json
└── .env.example
```

## Como empezar

1. Clona el repositorio y entra a la carpeta:
   ```
   git clone <url-del-repo>
   cd citas-medicas-web
   ```

2. Instala Node.js si no lo tienes: https://nodejs.org

3. Instala las dependencias:
   ```
   npm install
   ```

4. Copia el archivo de variables de entorno y ajusta tus datos reales de MySQL:
   ```
   cp .env.example .env
   ```
   Si usas XAMPP/WAMP, el usuario `root` normalmente tiene contrasena vacia por
   defecto: deja `DB_PASSWORD=` sin nada despues del signo igual.

5. Crea la base de datos en phpMyAdmin:
   - Pestana Importar → selecciona `sql/01_schema.sql` → Continuar
   - Repite con `sql/02_seed.sql` para los datos de ejemplo

6. Corre el servidor:
   ```
   npm start
   ```

7. Abre http://localhost:3000 y entra con una de las cuentas demo
   (contrasena `Demo1234` para las tres):

   | Rol           | Correo                          |
   |---------------|----------------------------------|
   | Administrador | admin@citasmedicas.com           |
   | Medico        | ana.torres@citasmedicas.com      |
   | Paciente      | jorge.vilchez@correo.com         |

## Estado actual

Lo que ya funciona: login y navegacion por rol con sesiones.

Pendiente de desarrollo:
- Modulo de administrador: CRUD de medicos, pacientes y especialidades
- Modulo de medico: ver agenda, bloquear dias
- Modulo de paciente: reservar cita, ver mis citas, cancelar
