import db from "../database/db.js";

const today = () => new Date().toISOString().slice(0, 10);

const getTutorForUser = async (connection, user) => {
    const [rows] = await connection.query(
        "SELECT id FROM tutores WHERE user_id = ? OR LOWER(email) = LOWER(?) LIMIT 1",
        [user.id, user.email]
    );
    return rows[0];
};

export const getTutorDashboard = async (req, res) => {
    let connection;
    try {
        connection = await db.pool.getConnection();
        const tutor = await getTutorForUser(connection, req.user);
        if (!tutor) return res.status(403).send("Tu cuenta no está vinculada a un tutor");
        await connection.query("UPDATE tutores SET user_id = ? WHERE id = ? AND user_id IS NULL", [req.user.id, tutor.id]);
        const [menores] = await connection.query(`
            SELECT m.id, CONCAT(m.nombre, ' ', m.apellido_pat, ' ', m.apellido_mat) AS nombre,
                   mt.es_principal,
                   EXISTS (
                     SELECT 1 FROM autorizaciones_recoleccion a
                     WHERE a.menor_id = m.id AND a.tutor_id = ? AND a.fecha_autorizacion = CURDATE()
                   ) AS puede_recoger_hoy
            FROM menor_tutor mt
            JOIN menor m ON m.id = mt.menor_id
            WHERE mt.tutor_id = ? AND m.activo = 1
            ORDER BY nombre
        `, [tutor.id, tutor.id]);
        const [relaciones] = await connection.query(`
            SELECT mt.menor_id, t.id, CONCAT(t.nombre, ' ', t.apellido_pat, ' ', t.apellido_mat) AS nombre
            FROM menor_tutor mt JOIN tutores t ON t.id = mt.tutor_id
            WHERE mt.menor_id IN (
                SELECT menor_id FROM menor_tutor WHERE tutor_id = ?
            )
            ORDER BY nombre
        `, [tutor.id]);
        const tutorsByMinor = new Map();
        for (const relation of relaciones) {
            if (!tutorsByMinor.has(relation.menor_id)) tutorsByMinor.set(relation.menor_id, []);
            tutorsByMinor.get(relation.menor_id).push(relation);
        }
        for (const menor of menores) {
            menor.tutores = tutorsByMinor.get(menor.id) || [];
        }
        res.render("tutor/dashboard", { menores, tutorId: tutor.id, fecha: today() });
    } catch (error) {
        console.error("Error obteniendo dashboard del tutor:", error);
        res.status(500).send("Error interno");
    } finally {
        connection?.release();
    }
};

export const createTutorAuthorization = async (req, res) => {
    const menorId = Number(req.body.menor_id);
    const tutorId = Number(req.body.tutor_id);
    if (!Number.isInteger(menorId) || !Number.isInteger(tutorId)) {
        return res.status(400).json({ error: "Menor y tutor son obligatorios" });
    }
    let connection;
    try {
        connection = await db.pool.getConnection();
        const tutor = await getTutorForUser(connection, req.user);
        if (!tutor) return res.status(403).json({ error: "Tu cuenta no está vinculada a un tutor" });
        const [principal] = await connection.query(`
            SELECT 1 FROM menor_tutor
            WHERE menor_id = ? AND tutor_id = ? AND es_principal = 1
        `, [menorId, tutor.id]);
        if (!principal.length) return res.status(403).json({ error: "Solo el tutor principal puede gestionar autorizaciones" });
        const [minor] = await connection.query("SELECT activo FROM menor WHERE id = ?", [menorId]);
        if (!minor.length) return res.status(404).json({ error: "Menor no encontrado" });
        if (!minor[0].activo) return res.status(409).json({ error: "El menor está inactivo" });
        const [relation] = await connection.query(
            "SELECT 1 FROM menor_tutor WHERE menor_id = ? AND tutor_id = ?", [menorId, tutorId]
        );
        if (!relation.length) return res.status(400).json({ error: "El tutor seleccionado no está relacionado con el menor" });
        await connection.query(`
            INSERT INTO autorizaciones_recoleccion (menor_id, tutor_id, fecha_autorizacion)
            VALUES (?, ?, CURDATE())
            ON DUPLICATE KEY UPDATE tutor_id = VALUES(tutor_id)
        `, [menorId, tutorId]);
        res.status(201).json({ success: true, message: "Autorización registrada para hoy" });
    } catch (error) {
        console.error("Error creando autorización del tutor:", error);
        res.status(500).json({ error: "No se pudo registrar la autorización" });
    } finally {
        connection?.release();
    }
};
