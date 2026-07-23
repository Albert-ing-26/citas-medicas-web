-- =========================================================
-- Datos adicionales (seed extra) - Sistema de Citas Médicas
-- Agrega especialidades y múltiples citas por paciente
-- =========================================================

USE `citasmedicas_db`;

-- ---------------------------------------------------------
-- 1. Agregar especialidades médicas adicionales
-- ---------------------------------------------------------
INSERT INTO especialidades (nombre, duracion_cita_minutos) VALUES
  ('Neurología', 30),
  ('Oftalmología', 20),
  ('Otorrinolaringología', 20),
  ('Traumatología', 30),
  ('Psiquiatría', 45),
  ('Oncología', 45),
  ('Endocrinología', 30),
  ('Gastroenterología', 30),
  ('Urología', 30),
  ('Neumología', 30);

-- ---------------------------------------------------------
-- 2. Insertar múltiples citas por paciente
-- Evitando colisiones en (id_medico, fecha, hora_inicio)
-- ---------------------------------------------------------
INSERT INTO citas (id_medico, id_paciente, fecha, hora_inicio, hora_fin, motivo_consulta, estado) VALUES
  (1, 1, '2026-07-28', '08:00:00', '08:20:00', 'Dolor de cabeza recurrente', 'pendiente'),
  (6, 1, '2026-07-29', '15:00:00', '15:30:00', 'Control de acné', 'pendiente'),
  (3, 2, '2026-07-28', '09:00:00', '09:20:00', 'Chequeo preventivo anual', 'pendiente'),
  (6, 2, '2026-07-28', '16:00:00', '16:30:00', 'Revisión de lunar en la espalda', 'pendiente'),
  (5, 2, '2026-07-29', '10:00:00', '10:45:00', 'Palpitaciones y fatiga', 'pendiente'),
  (2, 3, '2026-07-28', '10:00:00', '10:45:00', 'Control de presión arterial', 'pendiente'),
  (1, 3, '2026-07-29', '11:00:00', '11:20:00', 'Resfriado común', 'pendiente'),
  (4, 4, '2026-07-28', '11:00:00', '11:30:00', 'Control de crecimiento pediátrico', 'pendiente'),
  (6, 4, '2026-07-29', '09:30:00', '10:00:00', 'Alergia en la piel', 'pendiente'),
  (5, 5, '2026-07-28', '17:00:00', '17:45:00', 'Lectura de electrocardiograma', 'pendiente'),
  (3, 5, '2026-07-29', '08:30:00', '08:50:00', 'Dolor estomacal', 'pendiente');
