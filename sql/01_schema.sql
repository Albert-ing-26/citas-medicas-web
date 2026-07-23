-- =========================================================
-- Base de datos: citasmedicas_db
-- Diseño final: sin ciclos ni caminos duplicados (sin tabla PERSONAL)
-- Motor: MySQL / MariaDB (compatible con phpMyAdmin)
-- =========================================================

CREATE DATABASE IF NOT EXISTS `citasmedicas_db`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `citasmedicas_db`;

-- =========================================================
-- Limpieza automática de tablas existentes para reimportar
-- =========================================================
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS medico_horario;
DROP TABLE IF EXISTS dias_bloqueados;
DROP TABLE IF EXISTS citas;
DROP TABLE IF EXISTS medicos;
DROP TABLE IF EXISTS administradores;
DROP TABLE IF EXISTS pacientes;
DROP TABLE IF EXISTS bloques_horario;
DROP TABLE IF EXISTS especialidades;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- Tabla: ROLES (catálogo puro, sin datos de login)
-- =========================================================
CREATE TABLE roles (
  id_rol      INT AUTO_INCREMENT PRIMARY KEY,
  nombre_rol  VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- =========================================================
-- Tabla: ESPECIALIDADES
-- =========================================================
CREATE TABLE especialidades (
  id_especialidad        INT AUTO_INCREMENT PRIMARY KEY,
  nombre                 VARCHAR(80) NOT NULL,
  duracion_cita_minutos  INT NOT NULL DEFAULT 20
) ENGINE=InnoDB;

-- =========================================================
-- Tabla: BLOQUES_HORARIO
-- =========================================================
CREATE TABLE bloques_horario (
  id_bloque   INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(40) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin    TIME NOT NULL
) ENGINE=InnoDB;

-- =========================================================
-- Tabla: PACIENTES (independiente, con su propio login)
-- =========================================================
CREATE TABLE pacientes (
  id_paciente       INT AUTO_INCREMENT PRIMARY KEY,
  nombre            VARCHAR(80) NOT NULL,
  apellidos         VARCHAR(80) NOT NULL,
  correo            VARCHAR(120) NOT NULL UNIQUE,
  contrasena_hash   VARCHAR(255) NOT NULL,
  telefono          VARCHAR(20),
  estado            ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  fecha_registro    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dni               VARCHAR(15) UNIQUE,
  fecha_nacimiento  DATE,
  direccion         VARCHAR(150)
) ENGINE=InnoDB;

-- =========================================================
-- Tabla: ADMINISTRADORES (login propio + FK a ROLES)
-- =========================================================
CREATE TABLE administradores (
  id_admin          INT AUTO_INCREMENT PRIMARY KEY,
  id_rol            INT NOT NULL,
  nombre            VARCHAR(80) NOT NULL,
  apellidos         VARCHAR(80) NOT NULL,
  correo            VARCHAR(120) NOT NULL UNIQUE,
  contrasena_hash   VARCHAR(255) NOT NULL,
  telefono          VARCHAR(20),
  estado            ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  fecha_registro    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB;

-- =========================================================
-- Tabla: MEDICOS (login propio + FK a ROLES y ESPECIALIDADES)
-- =========================================================
CREATE TABLE medicos (
  id_medico         INT AUTO_INCREMENT PRIMARY KEY,
  id_rol            INT NOT NULL,
  id_especialidad   INT NOT NULL,
  nombre            VARCHAR(80) NOT NULL,
  apellidos         VARCHAR(80) NOT NULL,
  correo            VARCHAR(120) NOT NULL UNIQUE,
  contrasena_hash   VARCHAR(255) NOT NULL,
  telefono          VARCHAR(20),
  estado            ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  fecha_registro    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  colegiatura       VARCHAR(30) NOT NULL UNIQUE,
  CONSTRAINT fk_medico_rol          FOREIGN KEY (id_rol)          REFERENCES roles(id_rol),
  CONSTRAINT fk_medico_especialidad FOREIGN KEY (id_especialidad) REFERENCES especialidades(id_especialidad)
) ENGINE=InnoDB;

-- =========================================================
-- Tabla: CITAS
-- =========================================================
CREATE TABLE citas (
  id_cita          INT AUTO_INCREMENT PRIMARY KEY,
  id_medico        INT NOT NULL,
  id_paciente      INT NOT NULL,
  fecha            DATE NOT NULL,
  hora_inicio      TIME NOT NULL,
  hora_fin         TIME NOT NULL,
  motivo_consulta  VARCHAR(255),
  estado           ENUM('pendiente','confirmada','cancelada','atendida') NOT NULL DEFAULT 'pendiente',
  fecha_registro   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cita_medico   FOREIGN KEY (id_medico)   REFERENCES medicos(id_medico),
  CONSTRAINT fk_cita_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes(id_paciente)
) ENGINE=InnoDB;

-- =========================================================
-- Tabla: DIAS_BLOQUEADOS
-- =========================================================
CREATE TABLE dias_bloqueados (
  id_bloqueo  INT AUTO_INCREMENT PRIMARY KEY,
  id_medico   INT NOT NULL,
  fecha       DATE NOT NULL,
  motivo      VARCHAR(150),
  estado      ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
  CONSTRAINT fk_bloqueo_medico FOREIGN KEY (id_medico) REFERENCES medicos(id_medico)
) ENGINE=InnoDB;

-- =========================================================
-- Tabla: MEDICO_HORARIO
-- =========================================================
CREATE TABLE medico_horario (
  id_medico_horario  INT AUTO_INCREMENT PRIMARY KEY,
  id_medico          INT NOT NULL,
  id_bloque          INT NOT NULL,
  dia_semana         ENUM('lunes','martes','miercoles','jueves','viernes','sabado','domingo') NOT NULL,
  CONSTRAINT fk_medhor_medico FOREIGN KEY (id_medico) REFERENCES medicos(id_medico),
  CONSTRAINT fk_medhor_bloque FOREIGN KEY (id_bloque) REFERENCES bloques_horario(id_bloque)
) ENGINE=InnoDB;

