-- -------------------------------------------------------
-- Project Name: TastyApp Database
-- Database engine: MySQL
-- Purpose: Schema used by Better Auth and the application
-- -------------------------------------------------------

-- Better Auth user records and application roles.
CREATE TABLE IF NOT EXISTS `user` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `emailVerified` tinyint(1) NOT NULL DEFAULT 0,
  `image` text,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `role` varchar(50) NOT NULL DEFAULT 'encargado',
  CONSTRAINT `user_role_check` CHECK (`role` IN ('administrativo', 'encargado', 'enfermeria', 'tutor', 'client', 'admin', 'adminTasty', 'adminBetterAuth')),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_email_unique` (`email`)
) ENGINE=InnoDB;

-- Active Better Auth sessions.
CREATE TABLE IF NOT EXISTS `session` (
  `id` varchar(36) NOT NULL,
  `expiresAt` timestamp(3) NOT NULL,
  `token` varchar(255) NOT NULL,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` timestamp(3) NOT NULL,
  `ipAddress` text,
  `userAgent` text,
  `userId` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_token_unique` (`token`),
  KEY `session_user_id_idx` (`userId`),
  CONSTRAINT `session_user_id_fk`
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Password and provider accounts managed by Better Auth.
CREATE TABLE IF NOT EXISTS `account` (
  `id` varchar(36) NOT NULL,
  `accountId` text NOT NULL,
  `providerId` text NOT NULL,
  `userId` varchar(36) NOT NULL,
  `accessToken` text,
  `refreshToken` text,
  `idToken` text,
  `accessTokenExpiresAt` timestamp(3),
  `refreshTokenExpiresAt` timestamp(3),
  `scope` text,
  `password` text,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` timestamp(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `account_user_id_idx` (`userId`),
  CONSTRAINT `account_user_id_fk`
    FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Email verification and password reset tokens.
CREATE TABLE IF NOT EXISTS `verification` (
  `id` varchar(36) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `expiresAt` timestamp(3) NOT NULL,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `verification_identifier_idx` (`identifier`)
) ENGINE=InnoDB;

-- Tabla de Familias

CREATE TABLE IF NOT EXISTS `familia` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(255) NOT NULL,
  `contador_ids` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `familia_nombre_unique` (`nombre`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `menor` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(255) NOT NULL,
  `apellido_pat` VARCHAR(255) NOT NULL,
  `apellido_mat` VARCHAR(255) NOT NULL,
  `curp` VARCHAR(18) NOT NULL,
  `fecha_nacimiento` DATE NOT NULL,
  `familia_id` INT NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `id_gratuito` BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`id`),
  UNIQUE KEY `menor_curp_unique` (`curp`),
  FOREIGN KEY (`familia_id`) REFERENCES `familia`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tutores` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(255) NOT NULL,
  `apellido_pat` VARCHAR(255) NOT NULL,
  `apellido_mat` VARCHAR(255) NOT NULL,
  `curp` VARCHAR(18) NOT NULL,
  `telefono` VARCHAR(20) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `user_id` VARCHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tutor_curp_unique` (`curp`),
  UNIQUE KEY `tutor_user_unique` (`user_id`),
  CONSTRAINT `tutor_user_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `menor_tutor` (
  `menor_id` INT NOT NULL,
  `tutor_id` INT NOT NULL,
  `tipo_parentesco` VARCHAR(30) NOT NULL,
  `es_principal` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`menor_id`, `tutor_id`),
  CONSTRAINT `menor_tutor_parentesco_check`
    CHECK (`tipo_parentesco` IN ('padre', 'madre', 'tutor_principal', 'tutor_adicional', 'otro')),
  FOREIGN KEY (`menor_id`) REFERENCES `menor`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tutor_id`) REFERENCES `tutores`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `autorizaciones_recoleccion` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `menor_id` INT NOT NULL,
  `tutor_id` INT NOT NULL,
  `fecha_autorizacion` DATE NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `autorizacion_menor_fecha_unique` (`menor_id`, `fecha_autorizacion`),
  FOREIGN KEY (`menor_id`) REFERENCES `menor`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tutor_id`) REFERENCES `tutores`(`id`) ON DELETE CASCADE,
  CONSTRAINT `autorizacion_menor_tutor_fk`
    FOREIGN KEY (`menor_id`, `tutor_id`)
    REFERENCES `menor_tutor` (`menor_id`, `tutor_id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `intentos_recoleccion` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `menor_id` INT NOT NULL,
  `tutor_id` INT NULL,
  `fecha_intento` DATE NOT NULL,
  `motivo` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`menor_id`) REFERENCES `menor`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tutor_id`) REFERENCES `tutores`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;