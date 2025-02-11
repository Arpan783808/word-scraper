import express from "express";
import {dbConnect} from "./db.js";
import dotenv from "dotenv";
import cron from "node-cron";

import { scrapeWord } from "./scrape.js";
dotenv.config()
const app = express();
app.use(express.json());
dbConnect();
cron.schedule("*/10 * * * *", () => {
  console.log("🔄 Running scheduled scraper job...");
  scrapeWord();
});
app.get("/", (req, res) => {
  res.send("hello");
});
app.listen(3001, () => {
  console.log("app running at 3001");
});