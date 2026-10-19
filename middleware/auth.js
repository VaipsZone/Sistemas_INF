import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";

export const verifySession = async (req, res, next) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session) {
            return res.status(401).json({ error: "No autenticado" });
        }

        req.auth = session;
        req.user = session.user;
        next();
    } catch (error) {
        console.error("Error verificando sesión:", error);
        return res.status(401).json({ error: "Sesión inválida" });
    }
};

export const requireRole = (roles) => {
    const allowedRoles = new Set(roles);

    return (req, res, next) => {
        if (req.user && allowedRoles.has(req.user.role)) {
            next();
        } else {
            return res.status(403).json({ error: "Acceso denegado: no tienes acceso a esta función" });
        }
    };
};