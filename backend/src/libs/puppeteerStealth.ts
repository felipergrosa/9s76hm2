// Shared puppeteer-extra instance with stealth plugin.
// Uses require() to avoid TypeScript module-resolution issues with puppeteer-extra.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteerExtra = require("puppeteer-extra");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteerExtra.use(StealthPlugin());

export default puppeteerExtra;
