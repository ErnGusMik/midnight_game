import db, { s3 } from "../db.conn.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";

// Configure multer for in-memory storage
const upload = multer({ storage: multer.memoryStorage() });

// POST /games/:id/start
export const startGame = async (req, res, next) => {
    if (!req.body.hostName || !req.body.roomName) {
        return res
            .status(400)
            .json({ error: "hostName and roomName are required" });
    }

    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newGame = {
        hostName: req.body.hostName,
        roomName: req.body.roomName,
        joinCode: joinCode,
        players: [],
        status: "waiting",
    };

    await db.push("/games[]", newGame, true);

    // join admin player
    const adminPlayer = { name: req.body.hostName, score: 0, game: joinCode };
    const games = await db.getData("/games");
    const gameIndex = games.findIndex((g) => g.joinCode === joinCode);
    await db.push(`/games[${gameIndex}]/players[]`, adminPlayer, true);
    res.status(201).json(newGame);
};

// GET /games/:code/join?name=playerName
export const joinGame = async (req, res, next) => {
    if (!req.params.code || !req.query || !req.query.name) {
        return res
            .status(400)
            .json({ error: "Game code and player name are required" });
    }

    const games = await db.getData("/games");
    const gameIndex = games.findIndex((g) => g.joinCode === req.params.code);

    if (gameIndex === -1) {
        return res.status(404).json({ error: "Game not found" });
    }

    const newPlayer = { name: req.query.name, score: 0, game: req.params.code };
    await db.push(`/games[${gameIndex}]/players[]`, newPlayer, true);

    const game = await db.getData(`/games[${gameIndex}]`);
    res.status(200).json(game);
};

// GET /games/:code/players
export const getGamePlayers = async (req, res, next) => {
    if (!req.params.code) {
        return res.status(400).json({ error: "Game code is required" });
    }

    const games = await db.getData("/games");
    const game = games.find((g) => g.joinCode === req.params.code);

    if (!game) {
        return res.status(404).json({ error: "Game not found" });
    }

    res.status(200).json(game.players);
};

// DELETE /games/:code/leave?name=playerName
export const leaveGame = async (req, res, next) => {
    if (!req.params.code || !req.query || !req.query.name) {
        return res
            .status(400)
            .json({ error: "Game code and player name are required" });
    }

    const games = await db.getData("/games");
    const gameIndex = games.findIndex((g) => g.joinCode === req.params.code);
    if (gameIndex === -1) {
        return res.status(404).json({ error: "Game not found" });
    }

    const players = games[gameIndex].players;
    const playerIndex = players.findIndex((p) => p.name === req.query.name);
    if (playerIndex === -1) {
        return res.status(404).json({ error: "Player not found in the game" });
    }

    await db.delete(`/games[${gameIndex}]/players[${playerIndex}]`, true);
    res.status(200).json({ message: "Player has left the game" });
};

// POST /games/:code/upload - Upload images to S3
export const uploadImages = async (req, res, next) => {
    try {
        if (!req.params.code || !req.query || !req.query.name) {
            return res
                .status(400)
                .json({ error: "Game code and player name are required" });
        }

        if (!req.files || req.files.length === 0) {
            return res
                .status(400)
                .json({ error: "No files provided" });
        }

        const gameCode = req.params.code;
        const playerName = req.query.name;
        const uploadedUrls = [];

        // Upload each file to S3
        for (const file of req.files) {
            const timestamp = Date.now();
            // Sanitize filename to prevent signature issues with special characters
            const sanitizedName = file.originalname
                .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
                .replace(/_{2,}/g, '_'); // Remove consecutive underscores
            const filename = `${gameCode}/${playerName}/${timestamp}-${sanitizedName}`;

            try {
                const command = new PutObjectCommand({
                    Bucket: "midnight-dev",
                    Key: filename,
                    Body: file.buffer,
                    ContentType: file.mimetype || 'application/octet-stream', // Include ContentType
                    ContentLength: file.buffer.length, // Explicit length can prevent signature issues
                });

                await s3.send(command);
                uploadedUrls.push({
                    filename: file.originalname,
                    url: `https://silo.deployor.dev/midnight-dev/${encodeURIComponent(filename)}`,
                });
            } catch (uploadError) {
                console.error(`Error uploading ${file.originalname}:`, uploadError);
                return res
                    .status(500)
                    .json({ error: `Failed to upload ${file.originalname}` });
            }
        }

        res.status(200).json({
            message: "Images uploaded successfully",
            files: uploadedUrls,
        });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Server error during upload" });
    }
};

// POST /games/:id/photo
export const uploadPhoto = async (req, res, next) => {
    // edit this to be functional. multifile uploads :)
    const fileBuffer = await readFile("./image.png");
    await s3.send(
        new PutObjectCommand({
            Bucket: "midnight-dev",
            Key: "images/profile.png",
            Body: fileBuffer,
            ContentType: "image/png",
        })
    );
};
