-- =========================================================
-- Sistema de Citas Médicas - Script de creación de base de datos
-- Universidad Nacional de Piura
-- Actores: Administrador, Médico, Paciente
-- Compatible con phpMyAdmin / MySQL 8+
-- =========================================================

CREATE DATABASE IF NOT EXISTS citas_medicas_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE citas_medicas_db;

-- ---------------------------------------------------------
-- 1. USUARIOS (tabla base de autenticación para los 3 roles)
-- ---------------------------------------------------------
CREATE TABLE usuarios (
    id_usuario      INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(80)  NOT NULL,
    apellidos       VARCHAR(80)  NOT NULL,
    correo          VARCHAR(120) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    telefono        VARCHAR(20),
    rol             ENUM('admin', 'medico', 'paciente') NOT NULL,
    activo          BOOLEAN DEFAULT TRUE,
    fecha_registro  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 2. ESPECIALIDADES (catálogo)
-- ---------------------------------------------------------
CREATE TABLE especialidades (
    id_especialidad     INT AUTO_INCREMENT PRIMARY KEY,
    nombre               VARCHAR(80) NOT NULL UNIQUE,
    duracion_cita_minutos INT NOT NULL DEFAULT 30
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 3. BLOQUES_HORARIO (catálogo fijo: mañana / tarde)
-- ---------------------------------------------------------
CREATE TABLE bloques_horario (
    id_bloque   INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(40) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 4. MEDICOS (depende de usuarios y especialidades)
-- ---------------------------------------------------------
CREATE TABLE medicos (
    id_medico       INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario      INT NOT NULL UNIQUE,
    id_especialidad INT NOT NULL,
    colegiatura     VARCHAR(30) NOT NULL UNIQUE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE,
    FOREIGN KEY (id_especialidad) REFERENCES especialidades(id_especialidad)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 5. PACIENTES (depende de usuarios)
-- ---------------------------------------------------------
CREATE TABLE pacientes (
    id_paciente     INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario      INT NOT NULL UNIQUE,
    dni             VARCHAR(15) NOT NULL UNIQUE,
    fecha_nacimiento DATE,
    direccion       VARCHAR(150),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 6. DIAS_BLOQUEADOS (depende de medicos)
-- ---------------------------------------------------------
CREATE TABLE dias_bloqueados (
    id_bloqueo INT AUTO_INCREMENT PRIMARY KEY,
    id_medico  INT NOT NULL,
    fecha      DATE NOT NULL,
    motivo     VARCHAR(150),
    FOREIGN KEY (id_medico) REFERENCES medicos(id_medico)
        ON DELETE CASCADE,
    UNIQUE (id_medico, fecha)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- 7. CITAS (depende de medicos y pacientes)
-- ---------------------------------------------------------
CREATE TABLE citas (
    id_cita        INT AUTO_INCREMENT PRIMARY KEY,
    id_medico      INT NOT NULL,
    id_paciente    INT NOT NULL,
    fecha          DATE NOT NULL,
    hora_inicio    TIME NOT NULL,
    hora_fin       TIME NOT NULL,
    motivo_consulta VARCHAR(255) NOT NULL,
    estado         ENUM('pendiente', 'confirmada', 'cancelada', 'atendida')
                   NOT NULL DEFAULT 'pendiente',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_medico) REFERENCES medicos(id_medico)
        ON DELETE CASCADE,
    FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente)
        ON DELETE CASCADE,
    -- Evita que dos pacientes reserven el mismo horario con el mismo médico
    UNIQUE (id_medico, fecha, hora_inicio)
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- Índices adicionales útiles para las consultas más comunes
-- ---------------------------------------------------------
CREATE INDEX idx_citas_paciente ON citas(id_paciente);
CREATE INDEX idx_citas_medico_fecha ON citas(id_medico, fecha);
