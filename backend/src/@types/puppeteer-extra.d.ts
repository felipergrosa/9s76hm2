declare module "puppeteer-extra" {
  import puppeteer from "puppeteer";
  const puppeteerExtra: typeof puppeteer & {
    use(plugin: any): typeof puppeteerExtra;
  };
  export default puppeteerExtra;
}

declare module "puppeteer-extra-plugin-stealth" {
  function StealthPlugin(): any;
  export default StealthPlugin;
}
