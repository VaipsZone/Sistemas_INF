import { Router } from "express";
import { verifySession, requireRole } from "../middleware/auth.js";
import { getDashboard, getUsers, createUser, updateUser, deleteUser } from "../controllers/adminController.js";
import { getMenoresDashboard, getNewMenor, getEditMenor, createMenor, updateMenor, getMenor } from "../controllers/menoresController.js";
import { getAutorizaciones, verifyAutorizacion } from "../controllers/autorizacionesController.js";
import { getTutorDashboard, createTutorAuthorization } from "../controllers/tutorController.js";

const router = new Router();

router.get("/", (req, res) => {
  res.render("login");
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.get("/register", (req, res) => {
  res.render("register");
});

router.get("/menu", verifySession, (req, res) => {
  res.render("menu", { role: req.user.role });
});

router.get("/admin/dashboard", verifySession, requireRole(["administrativo"]), getDashboard);

router.get("/admin/users", verifySession, requireRole(["administrativo"]), getUsers);

router.post("/admin/users", verifySession, requireRole(["administrativo"]), createUser);

router.post("/admin/users/:id/edit", verifySession, requireRole(["administrativo"]), updateUser);

router.delete("/admin/users/:id", verifySession, requireRole(["administrativo"]), deleteUser);

router.get("/admin/menores", verifySession, requireRole(["administrativo"]), getMenoresDashboard);
router.get("/admin/menores/nuevo", verifySession, requireRole(["administrativo"]), getNewMenor);
router.post("/admin/menores", verifySession, requireRole(["administrativo"]), createMenor);
router.get("/admin/menores/:id/editar", verifySession, requireRole(["administrativo"]), getEditMenor);
router.post("/admin/menores/:id", verifySession, requireRole(["administrativo"]), updateMenor);
router.get("/admin/menores/:id", verifySession, requireRole(["administrativo"]), getMenor);

router.get("/encargado/autorizaciones", verifySession, requireRole(["encargado"]), getAutorizaciones);
router.post("/encargado/autorizaciones/verificar", verifySession, requireRole(["encargado"]), verifyAutorizacion);

router.get("/tutor/dashboard", verifySession, requireRole(["tutor"]), getTutorDashboard);
router.post("/tutor/autorizaciones", verifySession, requireRole(["tutor"]), createTutorAuthorization);

export default router;