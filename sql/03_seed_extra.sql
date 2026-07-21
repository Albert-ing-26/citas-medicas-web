-- =========================================================
-- Datos adicionales (seed extra) - Sistema de Citas Médicas
-- Agrega 10 especialidades más y múltiples citas por paciente
-- =========================================================

USE citas_medicas_db;

-- ---------------------------------------------------------
-- 1. Agregar 10 especialidades médicas adicionales
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
-- 2. Insertar múltiples citas por paciente (IDs de paciente del 1 al 5)
-- Evitando colisiones en (id_medico, fecha, hora_inicio)
-- Médicos disponibles:
--   1: Ana Torres (Medicina, 20 min)
--   2: Diego Maza (Cardiología, 45 min)
--   3: Luis Fernández (Medicina, 20 min)
--   4: Maria Delgado (Pediatría, 30 min)
--   5: Elena Gutiérrez (Cardiología, 45 min)
--   6: Javier Ramos (Dermatología, 30 min)
-- ---------------------------------------------------------
INSERT INTO citas (id_medico, id_paciente, fecha, hora_inicio, hora_fin, motivo_consulta, estado) VALUES
-- Paciente 1 (Jorge Vílchez)
(1, 1, '2026-07-28', '08:00:00', '08:20:00', 'Dolor de cabeza recurrente', 'pendiente'),
(6, 1, '2026-07-29', '15:00:00', '15:30:00', 'Control de acné', 'pendiente'),

-- Paciente 2 (Pedro Mechato)
(3, 2, '2026-07-28', '09:00:00', '09:20:00', 'Chequeo preventivo anual', 'pendiente'),
(6, 2, '2026-07-28', '16:00:00', '16:30:00', 'Revisión de lunar en la espalda', 'pendiente'),
(5, 2, '2026-07-29', '10:00:00', '10:45:00', 'Palpitaciones y fatiga', 'pendiente'),

-- Paciente 3 (Fermin Silva)
(2, 3, '2026-07-28', '10:00:00', '10:45:00', 'Control de presión arterial', 'pendiente'),
(1, 3, '2026-07-29', '11:00:00', '11:20:00', 'Resfriado común', 'pendiente'),

-- Paciente 4 (Camila Alva)
(4, 4, '2026-07-28', '11:00:00', '11:30:00', 'Control de crecimiento pediátrico', 'pendiente'),
(6, 4, '2026-07-29', '09:30:00', '10:00:00', 'Alergia en la piel', 'pendiente'),

-- Paciente 5 (Rosa Flores)
(5, 5, '2026-07-28', '17:00:00', '17:45:00', 'Lectura de electrocardiograma', 'pendiente'),
(3, 5, '2026-07-29', '08:30:00', '08:50:00', 'Dolor estomacal', 'pendiente');
