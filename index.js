import express from "express";
import {dbConnect} from "./db.js";
import dotenv from "dotenv";
import { scrapeWord } from "./scrape.js";
dotenv.config()
const app = express();
app.use(express.json());
dbConnect();
scrapeWord();
app.get("/", (req, res) => {
  res.send("hello");
});
app.listen(3001, () => {
  console.log("app running at 3001");
});