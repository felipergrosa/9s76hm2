import { Request, Response } from "express";
import Version from "../models/Versions";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const record = await Version.findByPk(1);

  const safeExec = (cmd: string): string => {
    try { return execSync(cmd).toString().trim(); } catch { return ""; }
  };
  const safeRead = (p: string): string => {
    try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; }
  };
  const findGitDir = (): string => {
    let dir = process.cwd();
    for (let i = 0; i < 4; i += 1) {
      const gitPath = path.join(dir, ".git");
      try {
        if (fs.existsSync(gitPath)) {
          try {
            const stat = fs.lstatSync(gitPath);
            if (stat.isDirectory()) return gitPath;
            const content = fs.readFileSync(gitPath, "utf8");
            const m = content.match(/gitdir:\s*(.*)\s*/i);
            if (m && m[1]) {
              const gitDirPath = path.isAbsolute(m[1]) ? m[1] : path.resolve(dir, m[1]);
              if (fs.existsSync(gitDirPath)) return gitDirPath;
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return "";
  };
  const readCommitFromGitDir = (): string => {
    try {
      const gitDir = findGitDir();
      if (!gitDir) return "";
      const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
      if (head.startsWith("ref:")) {
        const ref = head.split(":")[1].trim();
        const refPath = path.join(gitDir, ref);
        if (fs.existsSync(refPath)) {
          const full = fs.readFileSync(refPath, "utf8").trim();
          return full.substring(0, 7);
        }
      } else if (/^[0-9a-f]{7,40}$/i.test(head)) {
        return head.substring(0, 7);
      }
    } catch { /* ignore */ }
    return "";
  };

  const fileCommit = safeRead(path.join(process.cwd(), ".git-commit"));
  const rawCommit = process.env.GIT_COMMIT || fileCommit || safeExec("git rev-parse --short HEAD") || readCommitFromGitDir() || "N/A";
  const commit = rawCommit || "N/A";
  const commitShort = commit && commit.length >= 6 ? commit.substring(0, 6) : commit;

  const fileBuildDate = safeRead(path.join(process.cwd(), ".build-date"));
  const buildDate = process.env.BUILD_DATE || fileBuildDate || new Date().toISOString();

  const backendVersion = record?.versionBackend || process.env.BACKEND_VERSION || "N/A";
  const versionLabel = backendVersion && commitShort && commitShort !== "N/A" ? `${backendVersion}+${commitShort}` : backendVersion;

  return res.status(200).json({
    version: record?.versionFrontend || "N/A",
    backend: {
      version: backendVersion,
      versionLabel,
      commit,
      commitShort,
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
