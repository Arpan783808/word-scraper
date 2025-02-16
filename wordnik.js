import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { dbConnect } from "./db.js";
import { Word } from "./wordmodel.js";

puppeteer.use(StealthPlugin());

let isScraperRunning = false;

export const scrapeWordnik = async (retryCount = 0) => {
  if (isScraperRunning) {
    console.log("⚠️ Scraper is already running, skipping execution...");
    return;
  }
  isScraperRunning = true;
  console.log("✅Wordnik Scraper started...");
  const browser = await puppeteer.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=site-per-process",
      "--window-size=1920,1080",
    ],
  });

  try {
    const page = await browser.newPage();
    const url = "https://www.wordnik.com/word-of-the-day";
    console.log(`🔍 Visiting: ${url}`);

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 120000,
    });

    const word = await page.evaluate(() => {
      const word = document
        .querySelector(".content_column a")
        .textContent.trim();
      return word;
    });

    if (!word) {
      throw new Error("❌ No words found.");
    }

    console.log(`✅ Extracted words: ${word}`);
    await dbConnect();

    let meaning = await page.evaluate(() => {
      const element = document.querySelector(".guts li");
      return element ? element.textContent.trim() : null;
    });

    let sentence = await page.evaluate(() => {
      const element = document.querySelector(".examples p");
      return element ? element.textContent.trim() : null;
    });

    let pronounciation = await page.evaluate(() => {
      const element = document.querySelector("div.phons_br span.phon");
      return element ? element.textContent.trim() : null;
    });

    if (!meaning) {
      console.log(`⚠️ No meaning found for ${word}`);
      return;
    }

    // Remove unwanted characters in meaning
    meaning = meaning.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
    const pronunciationPage = `https://howjsay.com/how-to-pronounce-${word}`;
    await page.goto(pronunciationPage, { waitUntil: "domcontentloaded" });

    const pronunciationAudioUrl = await page.evaluate(() => {
      const audioSource = document.querySelector(".alphContain audio source");
      return audioSource ? audioSource.getAttribute("src") : null;
    });

    if (!pronunciationAudioUrl) {
      console.log(`⚠️ No pronunciation audio for ${word}`);
    }
    const existingWord = await Word.findOne({ word });
    if (!existingWord) {
      await Word.create({
        word,
        meaning,
        sentence: sentence || "N/A",
        pronounciation: pronounciation || "N/A",
        audiourl: pronunciationAudioUrl,
      });
      console.log(`✅ Saved: ${word} -> ${meaning}`);
    } else {
      console.log(`⚠️ Word already exists: ${word}`);
    }
  } catch (error) {
    console.error("🚨 Error in scraper:", error);
    if (retryCount < 2) {
      console.log(`🔄 Retrying... (${retryCount + 1}/2)`);
      await scrapeWordnik(retryCount + 1);
    }
  } finally {
    await browser.close();
    isScraperRunning = false;
  }
};
