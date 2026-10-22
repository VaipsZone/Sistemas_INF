import db from "../database/db.js";
import { auth } from "../lib/auth.js";

const parentTypes = new Set(["padre", "madre", "tutor_principal"]);
const additionalType = "tutor_adicional";
const emailPattern = /^\S+@\S+\.\S+$/;

const ensureTutorAccount = async (connection, tutorId, tutor) => {
    const [linked] = await connection.query(
        "SELECT user_id FROM tutores WHERE id = ? FOR UPDATE", [tutorId]
    );
    if (linked[0]?.user_id) return linked[0].user_id;

    const [users] = await connection.query(
        "SELECT id, role FROM user WHERE LOWER(email) = LOWER(?) LIMIT 1", [tutor.email]
    );
    if (users.length) {
        if (users[0].role !== "tutor") {
            throw new Error("El correo del tutor ya pertenece a una cuenta con otro rol");
        }
        await connection.query("UPDATE tutores SET user_id = ? WHERE id = ?", [users[0].id, tutorId]);
        return users[0].id;
    }

    const result = await auth.api.signUpEmail({
        body: {
            name: `${tutor.nombre} ${tutor.apellido_pat} ${tutor.apellido_mat}`.trim(),
            email: tutor.email,
            password: tutor.curp,
        },
    });
    if (!result?.user?.id) {
        throw new Error("No se pudo crear la cuenta del tutor");
    }
    await connection.query("UPDATE user SET role = 'tutor' WHERE id = ?", [result.user.id]);
    await connection.query("UPDATE tutores SET user_id = ? WHERE id = ?", [result.user.id, tutorId]);
    return result.user.id;
};

const text = (value) => typeof value === "string" ? value.trim() : "";

const validateMinor = (body) => {
    const required = ["nombre", "apellido_pat", "apellido_mat", "curp", "fecha_nacimiento", "familia"];
    if (required.some((field) => !text(body[field]))) return "Todos los datos del menor y la familia son obligatorios";
    if (!/^[A-Z0-9]{18}$/i.test(text(body.curp))) return "La CURP debe tener 18 caracteres";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(body.fecha_nacimiento))) return "La fecha de nacimiento no es válida";
    return null;
};

const normalizeTutors = (value) => {
    const tutors = Array.isArray(value) ? value : [];
    return tutors.map((tutor) => ({
        id: Number.isInteger(Number(tutor.id)) ? Number(tutor.id) : null,
        nombre: text(tutor.nombre),
        apellido_pat: text(tutor.apellido_pat),
        apellido_mat: text(tutor.apellido_mat),
        curp: text(tutor.curp).toUpperCase(),
        telefono: text(tutor.telefono),
        email: text(tutor.email).toLowerCase(),
        tipo_parentesco: text(tutor.tipo_parentesco),
    })).filter((tutor) => Object.values(tutor).some(Boolean));
};

const validateTutors = (tutors) => {
    if (!tutors.length) return "Debe registrar al menos un padre o tutor principal";
    if (!tutors.some((tutor) => parentTypes.has(tutor.tipo_parentesco))) {
        return "Debe registrar al menos un padre o tutor principal";
    }
    if (tutors.filter((tutor) => tutor.tipo_parentesco === additionalType).length > 4) {
        return "Un menor puede tener como máximo cuatro tutores adicionales";
    }
    if (tutors.some((tutor) => !tutor.nombre || !tutor.curp || !tutor.telefono ||
        !tutor.email || !emailPattern.test(tutor.email) ||
        !["padre", "madre", "tutor_principal", additionalType].includes(tutor.tipo_parentesco))) {
        return "Los datos de cada tutor deben estar completos y ser válidos";
    }
    return null;
};

export const getMenoresDashboard = async (req, res) => {
    let connection;
    try {
        connection = await db.pool.getConnection();
        const [menores] = await connection.query(`
            SELECT m.id, m.nombre, m.apellido_pat, m.apellido_mat, m.curp,
                   m.fecha_nacimiento, m.activo, m.id_gratuito, f.nombre AS familia
            FROM menor m LEFT JOIN familia f ON f.id = m.familia_id
            ORDER BY m.nombre, m.apellido_pat
        `);
        res.render("admin/menoresDashboard", { menores });
    } catch (error) {
        console.error("Error obteniendo menores:", error);
        res.status(500).send("Error interno");
    } finally {
        connection?.release();
    }
};

export const getNewMenor = (req, res) => res.render("admin/menorForm");

export const getEditMenor = async (req, res) => {
    let connection;
    try {
        connection = await db.pool.getConnection();
        const [rows] = await connection.query(`
            SELECT m.*, f.nombre AS familia
            FROM menor m JOIN familia f ON f.id = m.familia_id
            WHERE m.id = ?
        `, [req.params.id]);
        if (!rows.length) return res.status(404).send("Menor no encontrado");
        const [tutores] = await connection.query(`
            SELECT t.*, mt.tipo_parentesco, mt.es_principal
            FROM tutores t JOIN menor_tutor mt ON mt.tutor_id = t.id
            WHERE mt.menor_id = ? ORDER BY mt.es_principal DESC, t.nombre
        `, [req.params.id]);
        res.render("admin/menorEditForm", { menor: rows[0], tutores });
    } catch (error) {
        console.error("Error cargando edición del menor:", error);
        res.status(500).send("Error interno");
    } finally {
        connection?.release();
    }
};

export const createMenor = async (req, res) => {
    const validationError = validateMinor(req.body);
    const tutors = normalizeTutors(req.body.tutores);
    const tutorError = validateTutors(tutors);
    if (validationError || tutorError) return res.status(400).json({ error: validationError || tutorError });

    let connection;
    try {
        connection = await db.pool.getConnection();
        await connection.beginTransaction();
        const [families] = await connection.query(
            "SELECT id, contador_ids FROM familia WHERE nombre = ? FOR UPDATE", [text(req.body.familia)]
        );
        let familyId;
        let idCount;
        if (families.length) {
            familyId = families[0].id;
            idCount = families[0].contador_ids + 1;
            await connection.query("UPDATE familia SET contador_ids = ? WHERE id = ?", [idCount, familyId]);
        } else {
            idCount = 1;
            const [family] = await connection.query(
                "INSERT INTO familia (nombre, contador_ids) VALUES (?, 1)", [text(req.body.familia)]
            );
            familyId = family.insertId;
        }

        const [minor] = await connection.query(`
            INSERT INTO menor
              (nombre, apellido_pat, apellido_mat, curp, fecha_nacimiento, familia_id, id_gratuito)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            text(req.body.nombre), text(req.body.apellido_pat), text(req.body.apellido_mat),
            text(req.body.curp).toUpperCase(), text(req.body.fecha_nacimiento), familyId, idCount <= 5,
        ]);

        for (const tutor of tutors) {
            const [existing] = await connection.query(
                "SELECT id FROM tutores WHERE curp = ? LIMIT 1", [tutor.curp]
            );
            let tutorId = existing[0]?.id;
            if (!tutorId) {
                const [created] = await connection.query(`
                    INSERT INTO tutores (nombre, apellido_pat, apellido_mat, curp, telefono, email)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [tutor.nombre, tutor.apellido_pat, tutor.apellido_mat, tutor.curp, tutor.telefono, tutor.email]);
                tutorId = created.insertId;
            }
            await ensureTutorAccount(connection, tutorId, tutor);
            await connection.query(`
                INSERT INTO menor_tutor (menor_id, tutor_id, tipo_parentesco, es_principal)
                VALUES (?, ?, ?, ?)
            `, [minor.insertId, tutorId, tutor.tipo_parentesco, parentTypes.has(tutor.tipo_parentesco)]);
        }

        await connection.commit();
        res.status(201).json({
            success: true,
            id: minor.insertId,
            idGratuito: idCount <= 5,
            message: idCount <= 5 ? "ID registrado sin costo" : "A partir del sexto ID se genera un costo",
        });
    } catch (error) {
        await connection?.rollback();
        console.error("Error registrando menor:", error);
        res.status(500).json({ error: "No se pudo registrar el menor" });
    } finally {
        connection?.release();
    }
};

export const updateMenor = async (req, res) => {
    const validationError = validateMinor(req.body);
    const tutors = normalizeTutors(req.body.tutores);
    const tutorError = validateTutors(tutors);
    if (validationError || tutorError) return res.status(400).json({ error: validationError || tutorError });

    let connection;
    try {
        connection = await db.pool.getConnection();
        await connection.beginTransaction();
        const [minor] = await connection.query(
            "SELECT id, familia_id FROM menor WHERE id = ? FOR UPDATE", [req.params.id]
        );
        if (!minor.length) {
            await connection.rollback();
            return res.status(404).json({ error: "Menor no encontrado" });
        }

        const [families] = await connection.query(
            "SELECT id FROM familia WHERE nombre = ? FOR UPDATE", [text(req.body.familia)]
        );
        let familyId = families[0]?.id;
        if (!familyId) {
            const [family] = await connection.query(
                "INSERT INTO familia (nombre, contador_ids) VALUES (?, 0)", [text(req.body.familia)]
            );
            familyId = family.insertId;
        }

        await connection.query(`
            UPDATE menor
            SET nombre = ?, apellido_pat = ?, apellido_mat = ?, curp = ?,
                fecha_nacimiento = ?, familia_id = ?
            WHERE id = ?
        `, [
            text(req.body.nombre), text(req.body.apellido_pat), text(req.body.apellido_mat),
            text(req.body.curp).toUpperCase(), text(req.body.fecha_nacimiento), familyId, req.params.id,
        ]);

        await connection.query("DELETE FROM menor_tutor WHERE menor_id = ?", [req.params.id]);
        for (const tutor of tutors) {
            let tutorId = tutor.id;
            if (tutorId) {
                const [existing] = await connection.query("SELECT id FROM tutores WHERE id = ?", [tutorId]);
                if (!existing.length) tutorId = null;
            }
            if (!tutorId) {
                const [existing] = await connection.query(
                    "SELECT id FROM tutores WHERE curp = ? LIMIT 1", [tutor.curp]
                );
                tutorId = existing[0]?.id;
            }
            if (tutorId) {
                await connection.query(`
                    UPDATE tutores
                    SET nombre = ?, apellido_pat = ?, apellido_mat = ?, curp = ?, telefono = ?, email = ?
                    WHERE id = ?
                `, [tutor.nombre, tutor.apellido_pat, tutor.apellido_mat, tutor.curp, tutor.telefono, tutor.email, tutorId]);
            } else {
                const [created] = await connection.query(`
                    INSERT INTO tutores (nombre, apellido_pat, apellido_mat, curp, telefono, email)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [tutor.nombre, tutor.apellido_pat, tutor.apellido_mat, tutor.curp, tutor.telefono, tutor.email]);
                tutorId = created.insertId;
            }
            await ensureTutorAccount(connection, tutorId, tutor);
            await connection.query(`
                INSERT INTO menor_tutor (menor_id, tutor_id, tipo_parentesco, es_principal)
                VALUES (?, ?, ?, ?)
            `, [req.params.id, tutorId, tutor.tipo_parentesco, parentTypes.has(tutor.tipo_parentesco)]);
        }

        await connection.commit();
        res.json({ success: true, message: "Información del menor actualizada" });
    } catch (error) {
        await connection?.rollback();
        console.error("Error actualizando menor:", error);
        res.status(500).json({ error: "No se pudo actualizar el menor" });
    } finally {
        connection?.release();
    }
};

export const getMenor = async (req, res) => {
    let connection;
    try {
        connection = await db.pool.getConnection();
        const [rows] = await connection.query(`
            SELECT m.*, f.nombre AS familia
            FROM menor m JOIN familia f ON f.id = m.familia_id WHERE m.id = ?
        `, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: "Menor no encontrado" });
        const [tutores] = await connection.query(`
            SELECT t.*, mt.tipo_parentesco, mt.es_principal
            FROM tutores t JOIN menor_tutor mt ON mt.tutor_id = t.id WHERE mt.menor_id = ?
        `, [req.params.id]);
        res.json({ ...rows[0], tutores });
    } catch (error) {
        console.error("Error obteniendo menor:", error);
        res.status(500).json({ error: "Error interno" });
    } finally {
        connection?.release();
    }
};
