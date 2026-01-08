import db from "./db.conn.js";

const WORDLIST = [
    "liquid",
    "light source",
    "device",
    "furniture",
    "clothing",
    "food",
    "vehicle",
    "tool",
    "musical instrument",
    "building",
    "appliance",
    "toy",
    "utensil",
    "sport",
    "weapon",
    "jewelry",
    "furniture",
    "electronics",
    "clothing",
    "book",
    // "furniture",
    // "furniture",
    // "furniture",
    // "furniture",
    // "furniture",
    // "furniture",
    // "furniture",
];

const replyToWebSocket = (ws, data, wss) => {
    const msgtype = data.type;

    switch (msgtype) {
        case "client:startGame":
            startGame(ws, data, wss);
            break;
        case "client:submitPhoto":
            submitPhoto(ws, data, wss);
            break;
        case "client:guessWord":
            guessWord(ws, data, wss);
            break; 
        default:
            // Surface unknown message types instead of silently ignoring them
            ws.send(
                JSON.stringify({
                    type: "error",
                    status: "400",
                    error: `Unknown message type: ${msgtype}`,
                })
            );
            break;
    }
};

const startGame = async (ws, data, wss) => {
    console.log("Starting game with data:", data);

    // Get gameId from the requesting client's metadata
    const gameId = ws.meta?.gameId;

    if (!gameId) {
        return ws.send(
            JSON.stringify({
                type: "error",
                status: "400",
                error: "Client not properly registered",
            })
        );
    }

    // Mark requesting client as in-game
    ws.meta.inGame = true;

    // Collect all connected clients for this game
    const registeredClients = [];
    wss.clients.forEach((client) => {
        // Only include clients that are connected to the same game
        if (client.meta?.gameId === gameId) {
            client.meta.inGame = true;
            registeredClients.push(client);
        }
    });
    console.log(
        `Starting game ${gameId} with ${registeredClients.length} players`
    );

    // Choose one person to be the imposter (randomly)
    const imposterIndex = Math.floor(Math.random() * registeredClients.length);
    let currentIndex = 0;

    // Broadcast to all registered clients and assign roles
    registeredClients.forEach((client) => {
        client.meta.role =
            currentIndex === imposterIndex ? "imposter" : "crewmate";

        if (client.readyState === client.OPEN) {
            client.send(
                JSON.stringify({
                    type: "server:gameStarted",
                    gameId: client.meta.gameId,
                    playerName: client.meta.playerName,
                    role: client.meta.role,
                    inGame: true,
                })
            );
        }
        currentIndex++;
    });

    sendWord(ws, data, wss);
};

const sendWord = async (ws, data, wss) => {
    const gameId = ws.meta?.gameId;
    if (!gameId) {
        return;
    }

    // For simplicity, using a static word list
    const randomIndex = Math.floor(Math.random() * WORDLIST.length);
    const chosenWord = WORDLIST[randomIndex];
    console.log(`Chosen word for game ${gameId}: ${chosenWord}`);

    // Broadcast the chosen word to all clients in the game
    wss.clients.forEach((client) => {
        if (
            client.meta?.gameId === gameId &&
            client.readyState === client.OPEN
        ) {
            if (client.meta.role === "crewmate") {
                client.send(
                    JSON.stringify({
                        type: "server:wordChosen",
                        word: chosenWord,
                    })
                );
            } else {
                // save the word in the meta for later
                client.meta.chosenWord = chosenWord;
            }
        }
    });
};

const submitPhoto = async (ws, data, wss) => {
    const gameId = ws.meta?.gameId;
    if (!gameId) {
        console.error("No gameId found in ws meta");
        return ws.send(
            JSON.stringify({
                type: "error",
                status: "400",
                error: "Missing gameId on connection",
            })
        );
    }

    if (!data.photo) {
        return ws.send(
            JSON.stringify({
                type: "error",
                status: "400",
                error: "No photo provided",
            })
        );
    }

    // store the photo link in the database
    try {
        const games = await db.getData("/games");
        const gameIndex = games.findIndex((g) => g.joinCode === gameId);
        if (gameIndex === -1) {
            return ws.send(
                JSON.stringify({
                    type: "error",
                    status: "404",
                    error: "Game not found",
                })
            );
        }
        const players = games[gameIndex].players;
        const playerIndex = players.findIndex(
            (p) => p.name === ws.meta.playerName
        );
        if (playerIndex === -1) {
            return ws.send(
                JSON.stringify({
                    type: "error",
                    status: "404",
                    error: "Player not found in the game",
                })
            );
        }
        await db.push(
            `/games[${gameIndex}]/players[${playerIndex}]/photo`,
            data.photo,
            true
        );

        ws.send(
            JSON.stringify({
                type: "server:photoSubmitted",
                status: "200",
                message: "Photo submitted successfully",
            })
        );
    } catch (error) {
        console.error("Error storing photo link:", error);
        ws.send(
            JSON.stringify({
                type: "error",
                status: "500",
                error: "Server error while storing photo link",
            })
        );
        return;
    }

    // Always broadcast the latest photo list so other clients see incremental updates
    await broadcastPhotos(gameId, wss);

    // Optional log when the last player submits
    const games = await db.getData("/games");
    const game = games.find((g) => g.joinCode === gameId);
    if (!game) {
        return;
    }
    const allSubmitted = game.players.every((p) => Boolean(p.photo));
    if (allSubmitted) {
        console.log(`All players have submitted photos for game ${gameId}`);
    }
};

const broadcastPhotos = async (gameId, wss) => {
    try {
        const games = await db.getData("/games");
        const game = games.find((g) => g.joinCode === gameId);
        if (!game) {
            return;
        }

        // Collect players with a stored photo link
        const photos = game.players
            .filter((p) => Boolean(p.photo))
            .map((p) => ({ name: p.name, photo: p.photo }));

        // Broadcast the current photo list to all clients in the same game
        wss.clients.forEach((client) => {
            if (client.meta?.gameId === gameId && client.readyState === client.OPEN) {
                client.send(
                    JSON.stringify({
                        type: "server:photosUpdated",
                        gameId,
                        photos,
                    })
                );
            }
        });
    } catch (error) {
        console.error("Error broadcasting photos:", error);
    }
};

const guessWord = async (ws, data, wss) => {
    const gameId = ws.meta?.gameId;
    if (!gameId) {
        return;
    }

    // check if user is imposter
    if (ws.meta.role !== "imposter") {
        return ws.send(
            JSON.stringify({
                type: "error",
                status: "403",
                error: "Only the imposter can make guesses",
            })
        );
    }

    if (!data.guess) {
        return ws.send(
            JSON.stringify({
                type: "error",
                status: "400",
                error: "No guess provided",
            })
        );
    }

    if (data.guess.toLowerCase() === ws.meta.chosenWord.toLowerCase()) {
        // correct guess
        wss.clients.forEach((client) => {
            if (
                client.meta?.gameId === gameId &&
                client.readyState === client.OPEN
            ) {
                client.send(
                    JSON.stringify({
                        type: "server:imposterGuessedCorrectly",
                        message: `${ws.meta.playerName} guessed the word correctly!`,
                    })
                );
            }
        });
    } else {
        // incorrect guess
        ws.send(
            JSON.stringify({
                type: "server:imposterGuessIncorrect",
                message: "Incorrect guess. Try again!",
            })
        );
    }
}

const sendVote = async (ws, data, wss) => {
    const gameId = ws.meta?.gameId;
    if (!gameId) {
        return;
    }

    if (!data.vote) {
        return ws.send(
            JSON.stringify({
                type: "error",
                status: "400",
                error: "No vote provided",
            })
        );
    }

    // store the vote in the database
    try {
        const games = await db.getData("/games");
        const gameIndex = games.findIndex((g) => g.joinCode === gameId);
        if (gameIndex === -1) {
            return ws.send(
                JSON.stringify({
                    type: "error",
                    status: "404",
                    error: "Game not found",
                })
            );
        }
        const players = games[gameIndex].players;
        const playerIndex = players.findIndex(
            (p) => p.name === ws.meta.playerName
        );
        if (playerIndex === -1) {
            return ws.send(
                JSON.stringify({
                    type: "error",
                    status: "404",
                    error: "Player not found in the game",
                })
            );
        }
        await db.push(
            `/games[${gameIndex}]/players[${playerIndex}]/vote`,
            data.vote,
            true
        );

        ws.send(
            JSON.stringify({
                type: "server:voteSubmitted",
                status: "200",
                message: "Vote submitted successfully",
            })
        );
    } catch (error) {
        console.error("Error storing vote:", error);
        ws.send(
            JSON.stringify({
                type: "error",
                status: "500",
                error: "Server error while storing vote",
            })
        );
    }
};

export default replyToWebSocket;
