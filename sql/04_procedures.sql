-- =========================================================
-- Base de datos: citasmedicas_db
-- Diseño final: sin ciclos ni caminos duplicados (sin tabla PERSONAL)
-- Motor: MySQL / MariaDB (compatible con phpMyAdmin)
-- =========================================================

USE `citasmedicas_db`;

DELIMITER //

CREATE PROCEDURE spCancelarCita(IN p_id_cita INT)
BEGIN
  DECLARE v_estado VARCHAR(20);

  SELECT estado INTO v_estado FROM citas WHERE id_cita = p_id_cita;

  IF v_estado IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cita no existe';
  ELSEIF v_estado NOT IN ('pendiente','confirmada') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cita no puede cancelarse en su estado actual';
  ELSE
    UPDATE citas SET estado = 'cancelada' WHERE id_cita = p_id_cita;
  END IF;
END //

CREATE PROCEDURE spListarCitasPaciente(IN p_dni VARCHAR(15))
BEGIN
  SELECT c.id_cita, c.fecha, c.hora_inicio, c.hora_fin, c.motivo_consulta, c.estado,
         m.nombre AS nombre_medico, m.apellidos AS apellidos_medico,
         e.nombre AS especialidad
  FROM citas c
  JOIN pacientes p       ON p.id_paciente = c.id_paciente
  JOIN medicos m         ON m.id_medico = c.id_medico
  JOIN especialidades e  ON e.id_especialidad = m.id_especialidad
  WHERE p.dni = p_dni
  ORDER BY c.fecha DESC;
END //

CREATE PROCEDURE spMedicosXEspecialidad(IN p_especialidad VARCHAR(80))
BEGIN
  SELECT m.id_medico, m.nombre, m.apellidos, m.colegiatura, m.correo, m.telefono,
         e.nombre AS especialidad, e.duracion_cita_minutos
  FROM medicos m
  JOIN especialidades e ON e.id_especialidad = m.id_especialidad
  WHERE e.nombre = p_especialidad
    AND m.estado = 'activo';
END //

CREATE PROCEDURE spReporteCitasXEstado(IN p_fecha_desde DATE, IN p_fecha_hasta DATE)
BEGIN
  SELECT estado, COUNT(*) AS total_citas
  FROM citas
  WHERE fecha BETWEEN p_fecha_desde AND p_fecha_hasta
  GROUP BY estado;
END //

DELIMITER ;
