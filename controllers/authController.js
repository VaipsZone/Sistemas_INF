// [  LOGIN  ]
import jwt from "jsonwebtoken";
import encrypt from "bcryptjs";
import db from "../database/db.js";

const jwtSecret = process.env.JWT_SECRET || "development-secret";

const validateUser = ({ username, email, password }) => {
    if (!username || username.trim().length < 3) return "El usuario debe tener al menos 3 caracteres";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return "El email no es válido";
    if (!password || password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
    return null;
};

const login = async (req, res) => {
    const { username, password } = req.body;
    let connection;

    try {
        connection = await db.pool.getConnection();
        // Check if user exists
        const [users] = await connection.query(
            "SELECT * FROM LOGINS WHERE Usuario = ?",
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const user = users[0];

        // Compare password
        const isMatch = await encrypt.compare(password, user.Password);
        if (!isMatch) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.log_id, rol: user.Rol },
            jwtSecret,
            { expiresIn: "2h" }
        );

        // Set token in httpOnly cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // true en https
            sameSite: "strict",
            maxAge: 2 * 60 * 60 * 1000 // 2 hours
        });

        res.json({ success: true, rol: user.Rol });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    } finally {
        connection?.release();
    }
};

const register = async (req, res) => {
    const { username, email, password } = req.body;
    const validationError = validateUser({ username, email, password });

    if (validationError) return res.status(400).json({ error: validationError });

    let connection;

    try {
        connection = await db.pool.getConnection();
        const [existingUser] = await connection.query(
            "SELECT log_id FROM LOGINS WHERE Usuario = ? OR Email = ? LIMIT 1",
            [username.trim(), email.trim()]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({ error: "El usuario o email ya está registrado" });
        }

        const hashedPassword = await encrypt.hash(password, 12);
        const [result] = await connection.query(
            "INSERT INTO LOGINS (Usuario, Email, Password) VALUES (?, ?, ?)",
            [username.trim(), email.trim(), hashedPassword]
        );
        res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        connection?.release();
    }
};

export default {
    login,
    register,
    jwtSecret
};