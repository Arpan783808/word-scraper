import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { dbConnect } from "./db.js";
import { Word } from "./wordmodel.js";

puppeteer.use(StealthPlugin());

let isScraperRunning = false; // Prevent overlapping executions

export const scrapeWord = async (retryCount = 0) => {
  if (isScraperRunning) {
    console.log("⚠️ Scraper is already running, skipping this execution...");
    return;
  }

  isScraperRunning = true;
  console.log("✅ Scraper started...");

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome-stable",
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
    const url = "https://www.merriam-webster.com/";
    console.log(`🔍 Visiting: ${url}`);

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 120000, // 2 minutes max wait
    });

    // Extract words
    const words = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".topten li .word-text"))
        .map((el) => el.textContent.trim())
        .filter((word) => word);
    });

    if (!words.length) {
      throw new Error("❌ No words found.");
    }

    console.log(`✅ Extracted words: ${words.join(", ")}`);

    await dbConnect();

    for (const word of words) {
      await page.goto(`https://www.merriam-webster.com/dictionary/${word}`, {
        waitUntil: "domcontentloaded",
      });

      let meaning = await page.evaluate(() => {
        const element = document.querySelector(".dtText");
        return element ? element.textContent.trim() : null;
      });

      const rawPronunciation = await page.evaluate(() => {
        const element = document.querySelector(".play-pron-v2");
        return element ? element.textContent.trim() : null;
      });

      const pronounciation = rawPronunciation
        ? rawPronunciation.split("How")[0].trim()
        : word;

      if (!meaning) {
        console.log(`⚠️ No meaning found for ${word}`);
        continue;
      }

      // Fetch pronunciation audio
      const pronunciationPage = `https://howjsay.com/how-to-pronounce-${word}`;
      await page.goto(pronunciationPage, { waitUntil: "domcontentloaded" });

      const pronunciationAudioUrl = await page.evaluate(() => {
        const audioSource = document.querySelector(".alphContain audio source");
        return audioSource ? audioSource.getAttribute("src") : null;
      });

      if (!pronunciationAudioUrl) {
        console.log(`⚠️ No pronunciation audio for ${word}`);
      }

      // Remove brackets (both () and [])
      meaning = meaning.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();

      const existingWord = await Word.findOne({ word });
      if (!existingWord) {
        await Word.create({
          word,
          meaning,
          pronounciation,
          audiourl: pronunciationAudioUrl,
        });
        console.log(`✅ Saved: ${word} -> ${meaning} -> ${pronounciation}`);
      } else {
        console.log(`⚠️ Word already exists: ${word}`);
      }
    }
  } catch (error) {
    console.error("🚨 Error in scraper:", error);
    if (retryCount < 2) {
      console.log(`🔄 Retrying... (${retryCount + 1}/2)`);
      await scrapeWord(retryCount + 1);
    }
  } finally {
    await browser.close();
    isScraperRunning = false;
  }
};


