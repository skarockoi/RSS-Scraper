import fs from "fs"
import path from 'path';
import pkg from "rss-to-json"; const { parse } = pkg;
import Inliner from "inliner"
import TelegramBot from "node-telegram-bot-api"

interface RSS {
    description: string;
    items: Article[];
    link: string;
}

interface Article {
    author: string;
    created: number;
    description: string;
    id: string;
    link: string;
    title: string;
}

// Environment variables
const RSS_URL: string = ""
const TELEGRAM_TOKEN: string = "";
const TELEGRAM_GROUP: string = "";
const ARTICLE_LOCK_TIME_MS: number = 3_600_000;
const INTERVAL_MS: number = 300_000;

// Globals
const telegram = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const exportPath: string = path.join(process.cwd(), "articles");
let articleHistory: Article[] = [];

const task = async () => {

    if (articleHistory.length > 100) { // cut articleHistory because memory leak
        articleHistory = articleHistory.slice(10);
    }

    if (!fs.existsSync(exportPath)) { // create export path if it has not been created yet or maybe deleted
        fs.mkdirSync(exportPath);
    }

    console.log("parsing...")
    const rss: RSS = await parse(RSS_URL);
    const articles: Article[] = rss.items

    for (const article of articles) {

        if (olderThanLockTime(article)) { 
            continue;
        }

        if (alreadyScraped(article)) { 
            continue;
        }

        const potentialArticleFolder: string = path.join(exportPath, article.created.toString());
        const potentialArticlePath: string = path.join(exportPath, article.created.toString(), "article.html");

        if (!fs.existsSync(potentialArticleFolder)) {
            fs.mkdirSync(potentialArticleFolder);
        }

        console.log("scraping...")
        fs.writeFileSync(potentialArticlePath, await scrape(article.link), 'utf8');

        console.log("sending...");
        await telegram.sendDocument(TELEGRAM_GROUP, potentialArticlePath, { disable_notification: true, caption: article.title }).catch(() => { console.log("error telegram") });

        fs.rmSync(potentialArticleFolder, { recursive: true, force: true });
        console.log("done.");
    }
}

task();
setInterval(task, INTERVAL_MS);


const olderThanLockTime = (currentArticle: Article): boolean => {

    if (Date.now() - currentArticle.created > ARTICLE_LOCK_TIME_MS) {
        return true;
    }
    return false
}

const alreadyScraped = (currentArticle: Article): boolean => {

    const hasCorrespondingObject = articleHistory.some(article => {
        return article.title === currentArticle.title;
    });

    if (hasCorrespondingObject) {
        return true;
    }
    else {
        articleHistory.push(currentArticle);
        return false;
    }
}

const scrape = (url: string): Promise<string> => {
    
    return new Promise((resolve, reject) => {
        const inlined = new Inliner(url, undefined, async (err, html) => {
            resolve(html);
        });
    })
}