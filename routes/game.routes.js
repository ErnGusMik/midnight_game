import db from "../db.conn.js";

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
