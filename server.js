import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { URL } from "url";
import router from "./handlers/games.handler.js";
import replyToWebSocket from "./game.websocket.js";
import db from "./db.conn.js";

const app = express();
const PORT = process.env.PORT || 3000;

// HTTP server middleware - MUST come before routes
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// HTTP routes
app.get("/", (req, res) => {
    res.send("Midnight Game Server - HTTP and WebSocket");
});

app.use("/games", router);

// Create HTTP server
const server = createServer(app);

// Create WebSocket server on the same port
const wss = new WebSocketServer({ server });

wss.on("connection", async (ws, req) => {
    console.log("New WebSocket connection established");

    // Parse query parameters from WebSocket URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const playerName = url.searchParams.get("name");
    const gameId = url.searchParams.get("gameId");

    // Validate that player and game are provided
    if (!playerName || !gameId) {
        ws.send(
            JSON.stringify({
                type: "error",
                status: "400",
                error: "Query parameters 'name' and 'gameId' are required",
            })
        );
        ws.close();
        return;
    }

    // Validate that the player is registered in the game
    try {
        const games = await db.getData("/games");
        const game = games.find((g) => g.joinCode === gameId);

        if (!game) {
            ws.send(
                JSON.stringify({
                    type: "error",
                    status: "404",
                    error: "Game not found",
                })
            );
            ws.close();
            return;
        }

        const isPlayerRegistered = game.players.some(
            (p) => p.name === playerName && p.game === gameId
        );

        if (!isPlayerRegistered) {
            ws.send(
                JSON.stringify({
                    type: "error",
                    status: "403",
                    error: "Player not registered in this game. Please join the game first.",
                })
            );
            ws.close();
            return;
        }
    } catch (error) {
        console.error("Error validating player:", error);
        ws.send(
            JSON.stringify({
                type: "error",
                status: "500",
                error: "Server error during validation",
            })
        );
        ws.close();
        return;
    }

    // Attach per-connection metadata
    ws.meta = {
        playerName,
        gameId,
        role: "unknown",
        inGame: false,
    };

    ws.on("message", (message) => {
        console.log("Received:", message.toString());
        // Handle WebSocket messages here
        try {
            const data = JSON.parse(message.toString());
            // Process game events, player actions, etc.
            replyToWebSocket(ws, data, wss);
            // ws.send(JSON.stringify({ type: "ack", data: "Message received" }));
        } catch (error) {
            console.error("Error parsing message:", error);
        }
    });

    ws.on("close", () => {
        console.log("WebSocket connection closed");
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: "welcome", message: "Connected to Midnight Game" }));
});

// Start the server (both HTTP and WebSocket)
server.listen(PORT, () => {
    console.log(`HTTP server running on http://localhost:${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
