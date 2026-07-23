-- =========================================================
-- Datos de ejemplo (seed) - Sistema de Citas Médicas
-- Ejecutar DESPUÉS de 01_schema.sql
-- =========================================================

USE `citasmedicas_db`;

-- ---------------------------------------------------------
-- Limpiar datos previos y preparar el seed
-- ---------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM medico_horario;
DELETE FROM dias_bloqueados;
DELETE FROM citas;
DELETE FROM medicos;
DELETE FROM pacientes;
DELETE FROM administradores;
DELETE FROM especialidades;
DELETE FROM bloques_horario;
DELETE FROM roles;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------
-- Roles base
-- ---------------------------------------------------------
INSERT INTO roles (nombre_rol) VALUES
  ('admin'),
  ('medico');

-- ---------------------------------------------------------
-- Especialidades
-- ---------------------------------------------------------
INSERT INTO especialidades (nombre, duracion_cita_minutos) VALUES
  ('Medicina General', 20),
  ('Cardiología', 30),
  ('Dermatología', 25),
  ('Pediatría', 20);

-- ---------------------------------------------------------
-- Bloques de horario fijo
-- ---------------------------------------------------------
INSERT INTO bloques_horario (nombre, hora_inicio, hora_fin) VALUES
  ('Mañana', '08:00:00', '13:00:00'),
  ('Tarde',  '14:00:00', '19:00:00');

-- ---------------------------------------------------------
-- Administrador de ejemplo
-- ---------------------------------------------------------
INSERT INTO administradores (id_rol, nombre, apellidos, correo, contrasena_hash, telefono, estado) VALUES
  (1, 'Carlos', 'Ramírez Vega', 'admin@citasmedicas.com', '$2b$10$myonADkcROSbxDA7kGJzcuKHS1yajLkiK/NYhd89AGRERPqkt3r3K', '999111222', 'activo');

-- ---------------------------------------------------------
-- Médico de ejemplo
-- ---------------------------------------------------------
INSERT INTO medicos (id_rol, id_especialidad, nombre, apellidos, correo, contrasena_hash, telefono, estado, colegiatura) VALUES
  (2, 2, 'Ana', 'Torres Chunga', 'medico@citasmedicas.com', '$2b$10$vmIi4kxB0nyYz9a05qzWbugKip6.fSN5gYD0X8ANBx5q8f5nkc2TS', '999333444', 'activo', 'CMP-45210');

-- ---------------------------------------------------------
-- Paciente de ejemplo
-- ---------------------------------------------------------
INSERT INTO pacientes (nombre, apellidos, correo, contrasena_hash, telefono, estado, dni, fecha_nacimiento, direccion) VALUES
  ('Jorge', 'Vílchez Peña', 'paciente@citasmedicas.com', '$2b$10$JbxxJbLu58pAZFZhA5GnTuWSnwzvwkwGygS4OI8wkV4YGi74peWIq', '999555666', 'activo', '45210678', '1998-05-14', 'Av. Grau 450, Piura');
