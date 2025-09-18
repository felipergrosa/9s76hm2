import { Request, Response } from "express";
import Version from "../models/Versions";
import { execSync } from "child_process";

export const index = async (req: Request, res: Response): Promise<Response> => {
    const record = await Version.findByPk(1);

    const safeGit = (cmd: string): string => {
        try {
            return execSync(cmd).toString().trim();
        } catch {
            return "";
        }
    };

    const commit = process.env.GIT_COMMIT || safeGit("git rev-parse --short HEAD") || "N/A";
    const buildDate = process.env.BUILD_DATE || safeGit("git log -1 --date=iso --format=%cd") || new Date().toISOString();

    return res.status(200).json({
        version: record?.versionFrontend || "N/A",
        backend: {
            version: record?.versionBackend || process.env.BACKEND_VERSION || "N/A",
            commit,
            buildDate
        }
    });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
    const payloadVersion = req.body.version;
    let record = await Version.findByPk(1);

    if (!record) {
        record = await Version.create({ id: 1, versionFrontend: payloadVersion } as any);
    } else {
        record.versionFrontend = payloadVersion;
        await record.save();
    }

    return res.status(200).json({
        version: record.versionFrontend
    });
};
