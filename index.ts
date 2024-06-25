import puppeteer, { Browser, Page, KeyInput } from "puppeteer";

function wait(n: number) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}

function sleep(seconds: number): void {
    return wait(seconds * 1000);
}

async function retry(action: () => Promise<void>, retries: number = 3, delay: number = 1000): Promise<void> {
    for (let i = 0; i < retries; i++) {
        try {
            await action();
            return;
        } catch (error) {
            console.warn(`Retry ${i + 1} failed: ${error}`);
            if (i < retries - 1) {
                await sleep(delay / 1000);
            }
        }
    }
    throw new Error(`Action failed after ${retries} retries`);
}

// handle cookie popup
async function handleCookiePopup(page: Page): Promise<void> {
    await retry(async () => {
        const cookiePopup = await page.$("#cookiesModal");
        if (cookiePopup) {
            await page.click(".buttons > .acceptAll");
            await sleep(2);
        }
    });
}

// handle consent popup
async function handleConsentPopup(page: Page): Promise<void> {
    await retry(async () => {
        const consentPopup = await page.$("div.fc-consent-root");
        if (consentPopup) {
            console.log('Consent loaded successfully')
            await page.click('button.fc-button.fc-cta-consent [aria-label="Consent"]');
            await sleep(2);
        }
    });
}

async function type(): Promise<void> {
    const url = "https://monkeytype.com/";

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--disable-web-security', // Disable CORS policy
                '--disable-features=IsolateOrigins,site-per-process', // Disable site isolation
                '--disable-site-isolation-trials',
                '--start-maximized'
            ]
        });

        page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 2});
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        await page.goto(url, { waitUntil: 'networkidle2' });

        await page.waitForSelector('#testConfig', { visible: true });

        await handleCookiePopup(page);

        await handleConsentPopup(page);

        // Ensure mode selector is available
        await page.waitForSelector("#testConfig > div > div.mode > div:nth-child(2)", { visible: true });
        await page.click("#testConfig > div > div.mode > div:nth-child(2)");
        sleep(2); 

        /***
         *  Loop through the class "word" and loop through letter tag and fetch the text then keypress the fetched text,
         *  After each loop in the word class, press the spacebar
         *  */
        const words = await page.$$(".word");
        for (let i = 0; i < words.length; i++) {
            const letters = await words[i].$$("letter");
            for (let j = 0; j < letters.length; j++) {
                sleep(0); // Change this duration to delay the typing speed
                await page.keyboard.press(
                    await letters[j].evaluate((node: any) => node.innerText)
                );
            }
            await page.keyboard.press("Space");
        }

        // Adding a delay to ensure all actions are complete
        await sleep(1);

        console.log('Typing complete. You can check the typing speed now.');

        // Keep the browser open for 6 seconds to observe the typing speed
        await sleep(6);

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

type().catch(error => {
    console.error('Failed to execute the typing function:', error);
});
