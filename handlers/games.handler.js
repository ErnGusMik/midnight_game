import express from "express";
import { getGamePlayers, joinGame, leaveGame, startGame } from "../routes/game.routes.js";
const router = express.Router();

// Define your routes here
router.get("/", (req, res) => {
    res.send("Hello from the router!");
});

router.post("/start", startGame);
router.get("/:code/join", joinGame);
router.get("/:code/players", getGamePlayers);
router.delete("/:code/leave", leaveGame);

export default router;
