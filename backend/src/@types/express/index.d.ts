import { User } from "../../models/User";

// Estende a interface Request do Express
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        companyId: number;
        profile: string;
        username?: string;
      };
      files?: any;
      rawBody?: Buffer;
    }
  }
}
