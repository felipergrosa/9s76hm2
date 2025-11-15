type DatabaseStatus = {
  online: boolean;
  lastError: string | null;
  lastCheckedAt: number | null;
};

let databaseStatus: DatabaseStatus = {
  online: false,
  lastError: "Status inicial ainda não verificado.",
  lastCheckedAt: null,
};

export function setDatabaseStatus(online: boolean, error?: string | null): void {
  databaseStatus = {
    online,
    lastError: error || null,
    lastCheckedAt: Date.now(),
  };
}

export function getDatabaseStatus(): DatabaseStatus {
  return databaseStatus;
}

