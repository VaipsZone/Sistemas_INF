import { Router } from "express";
import authController from "../controllers/authController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";
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

router.post("/register", authController.register);

// Login route
router.post("/login", authController.login);

router.get("/admin/dashboard", verifyToken, isAdmin, getDashboard);

router.get("/admin/users", verifyToken, isAdmin, getUsers);

router.post("/admin/users", verifyToken, isAdmin, createUser);

router.post("/admin/users/:id/edit", verifyToken, isAdmin, updateUser);

router.delete("/admin/users/:id", verifyToken, isAdmin, deleteUser);

export default router;