import { Router } from "express";
import { verifySession, requireRole } from "../middleware/auth.js";
import { getDashboard, getUsers, createUser, updateUser, deleteUser } from "../controllers/adminController.js";

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

router.get("/admin/dashboard", verifySession, requireRole(["admin"]), getDashboard);

router.get("/admin/users", verifySession, requireRole(["admin"]), getUsers);

router.post("/admin/users", verifySession, requireRole(["admin"]), createUser);

router.post("/admin/users/:id/edit", verifySession, requireRole(["admin"]), updateUser);

router.delete("/admin/users/:id", verifySession, requireRole(["admin"]), deleteUser);

export default router;