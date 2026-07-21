-- =========================================================
-- Sistema de Citas Médicas - Nuevos Procedimientos Almacenados
-- Universidad Nacional de Piura
-- Compatible con MySQL 8+ / MariaDB
-- (Excluye procedimientos preexistentes del sistema)
-- =========================================================

USE citas_medicas_db;

-- Eliminar procedimientos previos si existen para evitar conflictos en la importación
DROP PROCEDURE IF EXISTS sp_registrar_paciente;
DROP PROCEDURE IF EXISTS splistarcitasmedico;
DROP PROCEDURE IF EXISTS sp_toggle_estado_medico;
DROP PROCEDURE IF EXISTS sp_toggle_estado_paciente;

DELIMITER //

-- ---------------------------------------------------------
-- 1. REGISTRO DE PACIENTE
-- Inserta la cuenta en la tabla 'usuarios' y su perfil en
-- la tabla 'pacientes' de manera transaccional.
-- ---------------------------------------------------------
CREATE PROCEDURE sp_registrar_paciente(
    IN p_nombre VARCHAR(80),
    IN p_apellidos VARCHAR(80),
    IN p_correo VARCHAR(120),
    IN p_contrasena_hash VARCHAR(255),
    IN p_telefono VARCHAR(20),
    IN p_dni VARCHAR(15),
    IN p_fecha_nacimiento DATE,
    IN p_direccion VARCHAR(150),
    OUT p_id_usuario INT
)
BEGIN
    START TRANSACTION;
        -- 1. Insertar el registro en la tabla de autenticación general
        INSERT INTO usuarios (nombre, apellidos, correo, contrasena_hash, telefono, rol, activo)
        VALUES (p_nombre, p_apellidos, p_correo, p_contrasena_hash, p_telefono, 'paciente', TRUE);
        
        -- 2. Obtener el ID autogenerado
        SET p_id_usuario = LAST_INSERT_ID();
        
        -- 3. Insertar la extensión del perfil de paciente
        INSERT INTO pacientes (id_usuario, dni, fecha_nacimiento, direccion)
        VALUES (p_id_usuario, p_dni, p_fecha_nacimiento, p_direccion);
    COMMIT;
END //

-- ---------------------------------------------------------
-- 2. LISTAR CITAS POR MÉDICO
-- Obtiene la agenda de citas de un médico para un día específico.
-- ---------------------------------------------------------
CREATE PROCEDURE splistarcitasmedico(
    IN p_id_usuario_medico INT,
    IN p_fecha DATE
)
BEGIN
    SELECT
        c.id_cita,
        c.fecha,
        c.hora_inicio,
        c.hora_fin,
        CONCAT(TIME_FORMAT(c.hora_inicio, '%H:%i'), ' - ', TIME_FORMAT(c.hora_fin, '%H:%i')) AS hora_rango,
        c.motivo_consulta AS motivo,
        c.estado,
        u_pac.nombre AS nombre_paciente,
        u_pac.apellidos AS apellidos_paciente,
        p.dni AS dni_paciente,
        u_pac.telefono AS telefono_paciente
    FROM citas c
    INNER JOIN medicos m ON m.id_medico = c.id_medico
    INNER JOIN pacientes p ON p.id_paciente = c.id_paciente
    INNER JOIN usuarios u_pac ON u_pac.id_usuario = p.id_usuario
    WHERE m.id_usuario = p_id_usuario_medico AND c.fecha = p_fecha
    ORDER BY c.hora_inicio ASC, c.id_cita ASC;
END //

-- ---------------------------------------------------------
-- 3. BLOQUEAR O REACTIVAR CUENTA DE MÉDICO
-- Alterna el estado activo/inactivo (campo 'activo') del usuario médico.
-- ---------------------------------------------------------
CREATE PROCEDURE sp_toggle_estado_medico(
    IN p_id_medico INT
)
BEGIN
    UPDATE usuarios u
    INNER JOIN medicos m ON m.id_usuario = u.id_usuario
    SET u.activo = NOT u.activo
    WHERE m.id_medico = p_id_medico;
END //

-- ---------------------------------------------------------
-- 4. BLOQUEAR O REACTIVAR CUENTA DE PACIENTE
-- Alterna el estado activo/inactivo (campo 'activo') del usuario paciente.
-- ---------------------------------------------------------
CREATE PROCEDURE sp_toggle_estado_paciente(
    IN p_id_paciente INT
)
BEGIN
    UPDATE usuarios u
    INNER JOIN pacientes p ON p.id_usuario = u.id_usuario
    SET u.activo = NOT u.activo
    WHERE p.id_paciente = p_id_paciente;
END //

DELIMITER ;
