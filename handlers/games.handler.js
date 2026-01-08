import express from "express";
import multer from "multer";
import { getGamePlayers, joinGame, leaveGame, startGame, uploadImages } from "../routes/game.routes.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Define your routes here
router.get("/", (req, res) => {
    res.send("Hello from the router!");
});

router.post("/start", startGame);
router.get("/:code/join", joinGame);
router.get("/:code/players", getGamePlayers);
router.delete("/:code/leave", leaveGame);
router.post("/:code/upload", upload.array("images"), uploadImages);

export default router;
