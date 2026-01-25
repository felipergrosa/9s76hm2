
import cacheLayer from "../libs/cache";
import logger from "../utils/logger";

(async () => {
    logger.info("Initializing Clear Session Locks script...");
    try {
        const pattern = "wbot:mutex:*";
        logger.info(`Scanning for keys matching pattern: ${pattern}`);

        // This relies on cacheLayer implementing getKeys or exposed redis
        // cacheLayer.delFromPattern uses getKeys internally
        await cacheLayer.delFromPattern(pattern);

        logger.info("Successfully cleared all wbot:mutex locks.");
    } catch (error) {
        logger.error(`Error clearing session locks: ${error}`);
    } finally {
        logger.info("Script finished. Exiting...");
        process.exit(0);
    }
})();
