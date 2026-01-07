import express, { urlencoded, json } from "express";
import router from "./handlers/games.handler.js";
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Hello, World!");
});

app.use(urlencoded({ extended: true }));
app.use(json());

app.use("/games", router);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
