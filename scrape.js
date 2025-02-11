import puppeteer, { executablePath } from "puppeteer";
import { dbConnect } from "./db.js";
import { Word } from "./wordmodel.js";

let isScraperRunning = false; // Prevent overlapping executions

export const scrapeWord = async () => {
  if (isScraperRunning) {
    console.log("⚠️ Scraper is already running, skipping this execution...");
    return;
  }

  isScraperRunning = true; // Lock execution
  // console.log("hi");
  // console.log(puppeteer.executablePath);
  console.log("✅ Scraper started...");

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-features=site-per-process",
    ],
  });

  const page = await browser.newPage();

  try {
    const url = "https://www.merriam-webster.com/";
    console.log(`🔍 Visiting: ${url}`);

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 1200000,
    });

    // Extract words
    const words = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".topten li .word-text"))
        .map((el) => el.textContent.trim())
        .filter((word) => word);
    });

    if (!words.length) {
      console.log("❌ No words found.");
      await browser.close();
      isScraperRunning = false;
      return;
    }

    console.log(`✅ Extracted words: ${words.join(", ")}`);

    await dbConnect();

    for (const word of words) {
      await page.goto(`https://www.merriam-webster.com/dictionary/${word}`, {
        waitUntil: "domcontentloaded",
      });

      let meaning = await page.evaluate(() => {
        const element = document.querySelector(".dtText");
        return element ? element.textContent.trim() : "/";
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

      const pronunciationPage = `https://howjsay.com/how-to-pronounce-${word}`;
      await page.goto(pronunciationPage, { waitUntil: "domcontentloaded" });

      const pronunciationAudioUrl = await page.evaluate(() => {
        const audioSource = document.querySelector(".alphContain audio source");
        return audioSource ? audioSource.getAttribute("src") : null;
      });

      if (!pronunciationAudioUrl) {
        console.log("❌ No pronunciation audio found.");
      } else {
        console.log(`✅ Pronunciation Audio URL: ${pronunciationAudioUrl}`);
      }

      // Remove all content inside brackets (both () and [])
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
  } finally {
    await browser.close();
    isScraperRunning = false; // Unlock execution
  }
};

// Run once on startup
scrapeWord();

// Schedule scraper to run every 2 minutes
