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
            }
        }
    });
};

export default replyToWebSocket;
