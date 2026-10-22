import db from "../database/db.js";

const today = () => new Date().toISOString().slice(0, 10);

export const getAutorizaciones = async (req, res) => {
    let connection;
    try {
        connection = await db.pool.getConnection();
        const [menores] = await connection.query(`
            SELECT m.id, CONCAT(m.nombre, ' ', m.apellido_pat, ' ', m.apellido_mat) AS nombre,
                   a.tutor_id, CONCAT(t.nombre, ' ', t.apellido_pat, ' ', t.apellido_mat) AS tutor
            FROM menor m
            LEFT JOIN autorizaciones_recoleccion a
              ON a.menor_id = m.id AND a.fecha_autorizacion = CURDATE()
            LEFT JOIN tutores t ON t.id = a.tutor_id
            WHERE m.activo = 1 ORDER BY nombre
        `);
        const [tutores] = await connection.query(`
            SELECT mt.menor_id, t.id, t.nombre, t.apellido_pat, t.apellido_mat
            FROM menor_tutor mt JOIN tutores t ON t.id = mt.tutor_id
            JOIN menor m ON m.id = mt.menor_id
            WHERE m.activo = 1
            ORDER BY t.nombre, t.apellido_pat
        `);
        const tutorsByMinor = new Map();
        for (const tutor of tutores) {
            if (!tutorsByMinor.has(tutor.menor_id)) tutorsByMinor.set(tutor.menor_id, []);
            tutorsByMinor.get(tutor.menor_id).push(tutor);
        }
        for (const menor of menores) menor.tutores = tutorsByMinor.get(menor.id) || [];
        res.render("encargado/autorizaciones", { menores, fecha: today() });
    } catch (error) {
        console.error("Error obteniendo autorizaciones:", error);
        res.status(500).send("Error interno");
    } finally {
        connection?.release();
    }
};

export const verifyAutorizacion = async (req, res) => {
    const menorId = Number(req.body.menor_id);
    const tutorId = Number(req.body.tutor_id);
    if (!Number.isInteger(menorId) || !Number.isInteger(tutorId)) {
        return res.status(400).json({ error: "Menor y tutor son obligatorios" });
    }
    let connection;
    try {
        connection = await db.pool.getConnection();
        const [minor] = await connection.query("SELECT activo FROM menor WHERE id = ?", [menorId]);
        if (!minor.length) return res.status(404).json({ error: "Menor no encontrado" });
        if (!minor[0].activo) return res.status(409).json({ error: "No se puede autorizar un menor inactivo" });
        const [relation] = await connection.query(
            "SELECT 1 FROM menor_tutor WHERE menor_id = ? AND tutor_id = ?", [menorId, tutorId]
        );
        if (!relation.length) {
            await connection.query(
                "INSERT INTO intentos_recoleccion (menor_id, tutor_id, fecha_intento, motivo) VALUES (?, ?, CURDATE(), ?)",
                [menorId, tutorId, "El tutor no está relacionado con el menor"]
            );
            return res.status(403).json({ error: "El tutor no está autorizado para este menor" });
        }
        const [authorization] = await connection.query(`
            SELECT 1 FROM autorizaciones_recoleccion
            WHERE menor_id = ? AND tutor_id = ? AND fecha_autorizacion = CURDATE()
        `, [menorId, tutorId]);
        if (!authorization.length) {
            await connection.query(
                "INSERT INTO intentos_recoleccion (menor_id, tutor_id, fecha_intento, motivo) VALUES (?, ?, CURDATE(), ?)",
                [menorId, tutorId, "El tutor no tiene autorización vigente para hoy"]
            );
            return res.status(403).json({ error: "El tutor no está autorizado para recoger hoy" });
        }
        res.json({ success: true, message: "Recolección autorizada para hoy" });
    } catch (error) {
        console.error("Error registrando autorización:", error);
        res.status(500).json({ error: "No se pudo registrar la autorización" });
    } finally {
        connection?.release();
    }
};
