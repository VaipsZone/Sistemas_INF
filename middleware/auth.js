import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: "No autenticado" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
    }
};

export const isAdmin = (req, res, next) => {
    if (req.user && req.user.rol === "admin") {
        next();
    } else {
        return res.status(403).json({ error: "Acceso denegado: se requiere rol admin" });
    }
};