import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tastyapp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const hasColumn = async (connection, table, column) => {
  const [rows] = await connection.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
};

const hasConstraint = async (connection, table, constraint) => {
  const [rows] = await connection.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [table, constraint]
  );
  return rows.length > 0;
};

const hasIndex = async (connection, table, index) => {
  const [rows] = await connection.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows.length > 0;
};

const getRoleConstraints = async (connection) => {
  const [rows] = await connection.query(`
    SELECT tc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
      AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
      AND tc.TABLE_NAME = 'user'
      AND cc.CHECK_CLAUSE LIKE '%role%'
  `);
  return rows.map((row) => row.CONSTRAINT_NAME);
};

export const ensureSprint1Schema = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS familia (
        id INT NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(255) NOT NULL,
        contador_ids INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY familia_nombre_unique (nombre)
      ) ENGINE=InnoDB
    `);

    if (!(await hasColumn(connection, "familia", "contador_ids"))) {
      await connection.query(
        "ALTER TABLE familia ADD COLUMN contador_ids INT NOT NULL DEFAULT 0"
      );
    }
    if (!(await hasIndex(connection, "familia", "familia_nombre_unique"))) {
      await connection.query(
        "ALTER TABLE familia ADD UNIQUE KEY familia_nombre_unique (nombre)"
      );
    }

    for (const constraint of await getRoleConstraints(connection)) {
      await connection.query(`ALTER TABLE user DROP CHECK \`${constraint.replace(/`/g, "``")}\``);
    }
    await connection.query(`
      ALTER TABLE user ADD CONSTRAINT user_role_check
      CHECK (role IN ('administrativo', 'encargado', 'enfermeria', 'tutor', 'client', 'admin', 'adminTasty', 'adminBetterAuth'))
    `).catch((error) => {
      if (error.code !== "ER_DUP_CONSTRAINT_NAME") throw error;
    });

    await connection.query(`
      CREATE TABLE IF NOT EXISTS menor (
        id INT NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(255) NOT NULL,
        apellido_pat VARCHAR(255) NOT NULL,
        apellido_mat VARCHAR(255) NOT NULL,
        curp VARCHAR(18) NOT NULL,
        fecha_nacimiento DATE NOT NULL,
        familia_id INT NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        id_gratuito BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (id),
        UNIQUE KEY menor_curp_unique (curp),
        FOREIGN KEY (familia_id) REFERENCES familia(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    if (!(await hasColumn(connection, "menor", "id_gratuito"))) {
      await connection.query(
        "ALTER TABLE menor ADD COLUMN id_gratuito BOOLEAN NOT NULL DEFAULT TRUE"
      );
    }
    if (!(await hasIndex(connection, "menor", "menor_curp_unique"))) {
      await connection.query(
        "ALTER TABLE menor ADD UNIQUE KEY menor_curp_unique (curp)"
      );
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tutores (
        id INT NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(255) NOT NULL,
        apellido_pat VARCHAR(255) NOT NULL,
        apellido_mat VARCHAR(255) NOT NULL,
        curp VARCHAR(18) NOT NULL,
        telefono VARCHAR(20) NOT NULL,
        email VARCHAR(255) NOT NULL,
        user_id VARCHAR(36) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY tutor_curp_unique (curp),
        UNIQUE KEY tutor_user_unique (user_id),
        CONSTRAINT tutor_user_fk FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
    if (!(await hasColumn(connection, "tutores", "user_id"))) {
      await connection.query("ALTER TABLE tutores ADD COLUMN user_id VARCHAR(36) NULL");
    }
    if (!(await hasConstraint(connection, "tutores", "tutor_user_fk"))) {
      await connection.query(
        "ALTER TABLE tutores ADD CONSTRAINT tutor_user_fk FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL"
      );
    }
    if (!(await hasIndex(connection, "tutores", "tutor_user_unique"))) {
      await connection.query(
        "ALTER TABLE tutores ADD UNIQUE KEY tutor_user_unique (user_id)"
      );
    }
    if (!(await hasIndex(connection, "tutores", "tutor_curp_unique"))) {
      await connection.query("ALTER TABLE tutores ADD UNIQUE KEY tutor_curp_unique (curp)");
    }
    await connection.query(`
      CREATE TABLE IF NOT EXISTS menor_tutor (
        menor_id INT NOT NULL,
        tutor_id INT NOT NULL,
        tipo_parentesco VARCHAR(30) NOT NULL,
        es_principal TINYINT(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (menor_id, tutor_id),
        FOREIGN KEY (menor_id) REFERENCES menor(id) ON DELETE CASCADE,
        FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS autorizaciones_recoleccion (
        id INT NOT NULL AUTO_INCREMENT,
        menor_id INT NOT NULL,
        tutor_id INT NOT NULL,
        fecha_autorizacion DATE NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY autorizacion_menor_fecha_unique (menor_id, fecha_autorizacion),
        FOREIGN KEY (menor_id) REFERENCES menor(id) ON DELETE CASCADE,
        FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS intentos_recoleccion (
        id INT NOT NULL AUTO_INCREMENT,
        menor_id INT NOT NULL,
        tutor_id INT NULL,
        fecha_intento DATE NOT NULL,
        motivo VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (menor_id) REFERENCES menor(id) ON DELETE CASCADE,
        FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
  } finally {
    connection.release();
  }
};

export default {
  pool
};