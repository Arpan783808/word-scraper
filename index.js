import express from "express";
import {dbConnect} from "./db.js";
import dotenv from "dotenv";
import cron from "node-cron";
import { scrapeWordnik } from "./wordnik.js";
import { scrapeWord } from "./scrape.js";
import { vocabulary } from "./vocabulary.js";
dotenv.config()
const app = express();
app.use(express.json());
dbConnect();
cron.schedule("*/1 * * * *", () => {
  console.log("🔄 Running scheduled scraper job...");
  // scrapeWord();
  // scrapeWordnik();
  vocabulary();
});
app.get("/", (req, res) => {
  res.send("hello");
});
app.listen(3001, () => {
  console.log("app running at 3001");
});