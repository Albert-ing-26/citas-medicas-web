-- =========================================================
-- Datos de ejemplo (seed) - Sistema de Citas Médicas
-- Ejecutar DESPUÉS de 01_schema.sql
-- =========================================================

USE citas_medicas_db;

-- ---------------------------------------------------------
-- Especialidades (duración de cita distinta por especialidad)
-- ---------------------------------------------------------
INSERT INTO especialidades (nombre, duracion_cita_minutos) VALUES
('Medicina General', 20),
('Pediatría', 30),
('Cardiología', 45),
('Dermatología', 30),
('Ginecología', 30);

-- ---------------------------------------------------------
-- Bloques de horario fijo (con hora de almuerzo excluida)
-- ---------------------------------------------------------
INSERT INTO bloques_horario (nombre, hora_inicio, hora_fin) VALUES
('Mañana', '07:00:00', '12:00:00'),
('Tarde', '14:00:00', '22:00:00');

-- ---------------------------------------------------------
-- Usuarios demo (contraseña para los 3: Demo1234)
-- Hash generado con bcrypt (10 rounds)
-- ---------------------------------------------------------
INSERT INTO usuarios (nombre, apellidos, correo, contrasena_hash, telefono, rol) VALUES
('Carlos', 'Ramírez Vega', 'admin@citasmedicas.com', '$2b$10$Nokp9Sq5v7HFB8vQlBqk1.7.3IIoR6zRhc4XmiQffzsgdrhUhYT9i', '999111222', 'admin'),
('Ana', 'Torres Chunga', 'ana.torres@citasmedicas.com', '$2b$10$Nokp9Sq5v7HFB8vQlBqk1.7.3IIoR6zRhc4XmiQffzsgdrhUhYT9i', '999333444', 'medico'),
('Jorge', 'Vílchez Peña', 'jorge.vilchez@correo.com', '$2b$10$Nokp9Sq5v7HFB8vQlBqk1.7.3IIoR6zRhc4XmiQffzsgdrhUhYT9i', '999555666', 'paciente');

-- ---------------------------------------------------------
-- Perfil de médico (vinculado al usuario 'Ana Torres')
-- ---------------------------------------------------------
INSERT INTO medicos (id_usuario, id_especialidad, colegiatura)
SELECT id_usuario, 1, 'CMP-45210'
FROM usuarios WHERE correo = 'ana.torres@citasmedicas.com';

-- ---------------------------------------------------------
-- Perfil de paciente (vinculado al usuario 'Jorge Vílchez')
-- ---------------------------------------------------------
INSERT INTO pacientes (id_usuario, dni, fecha_nacimiento, direccion)
SELECT id_usuario, '45210678', '1998-05-14', 'Av. Grau 450, Piura'
FROM usuarios WHERE correo = 'jorge.vilchez@correo.com';
