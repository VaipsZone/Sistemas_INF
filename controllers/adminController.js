import db from "../database/db.js";
import { auth } from "../lib/auth.js";
const allowedRoles = new Set(["admin", "client"]);
const emailPattern = /^\S+@\S+\.\S+$/;

const validateUser = ({ username, email, password, requirePassword = false }) => {
    if (!username || username.trim().length < 3) return "El usuario debe tener al menos 3 caracteres";
    if (!email || !emailPattern.test(email.trim())) return "El email no es válido";
    if (requirePassword && (!password || password.length < 8)) return "La contraseña debe tener al menos 8 caracteres";
    return null;
};

const findDuplicate = async (connection, username, email, id = null) => {
    const query = id
        ? "SELECT id FROM user WHERE (name = ? OR email = ?) AND id <> ? LIMIT 1"
        : "SELECT id FROM user WHERE name = ? OR email = ? LIMIT 1";
    const params = id ? [username, email, id] : [username, email];
    const [rows] = await connection.query(query, params);
    return rows.length > 0;
};

export const createUser = async (req, res) => {
    const { username, email, password, rol = "client" } = req.body;
    let connection;
    try {
        const validationError = validateUser({ username, email, password, requirePassword: true });
        if (validationError) return res.status(400).json({ error: validationError });
        if (!allowedRoles.has(rol)) return res.status(400).json({ error: "Rol no válido" });
        connection = await db.pool.getConnection();
        if (await findDuplicate(connection, username.trim(), email.trim())) {
            return res.status(409).json({ error: "El usuario o email ya está registrado" });
        }

        const result = await auth.api.signUpEmail({
            body: {
                name: username.trim(),
                email: email.trim(),
                password,
            },
        });

        if (!result?.user?.id) {
            return res.status(400).json({ error: "No se pudo crear el usuario" });
        }

        await connection.query(
            "UPDATE user SET role = ? WHERE id = ?",
            [rol, result.user.id]
        );

        res.status(201).json({ success: true, id: result.user.id });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Error interno" });
    } finally {
        connection?.release();
    }
};

// Render dashboard page with users list
export const getDashboard = async (req, res) => {
    let connection;
    try {
        connection = await db.pool.getConnection();
        const [users] = await connection.query(
            "SELECT id AS log_id, name AS Usuario, email AS Email, role AS Rol FROM user"
        );
        res.render("admin/dashboard", { users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Error interno");
    } finally {
        connection?.release();
    }
};

// API to get all users (JSON) for AJAX if needed
export const getUsers = async (req, res) => {
    let connection;
    try {
        connection = await db.pool.getConnection();
        const [users] = await connection.query(
            "SELECT id AS log_id, name AS Usuario, email AS Email, role AS Rol FROM user"
        );
        res.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Error interno" });
    } finally {
        connection?.release();
    }
};

// Update user (username, email, role, optionally password)
export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, email, rol, password } = req.body;
    let connection;

    try {
        const validationError = validateUser({ username, email });
        if (validationError) return res.status(400).json({ error: validationError });
        if (!allowedRoles.has(rol)) return res.status(400).json({ error: "Rol no válido" });
        connection = await db.pool.getConnection();
        if (await findDuplicate(connection, username.trim(), email.trim(), id)) {
            return res.status(409).json({ error: "El usuario o email ya está registrado" });
        }

        if (password) return res.status(400).json({ error: "La contraseña debe cambiarse mediante Better Auth" });

        const query = "UPDATE user SET name = ?, email = ?, role = ? WHERE id = ?";

        await connection.query(query, [username.trim(), email.trim(), rol, id]);
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Error interno" });
    } finally {
        connection?.release();
    }
};

// Delete user
export const deleteUser = async (req, res) => {
    const { id } = req.params;
    let connection;

    try {
        connection = await db.pool.getConnection();
        // Also delete related profile and phones (if any) - assuming cascade or manual
        await connection.query("DELETE FROM session WHERE userId = ?", [id]);
        await connection.query("DELETE FROM account WHERE userId = ?", [id]);
        const [result] = await connection.query("DELETE FROM user WHERE id = ?", [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: "Usuario no encontrado" });
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Error interno" });
    } finally {
        connection?.release();
    }
};