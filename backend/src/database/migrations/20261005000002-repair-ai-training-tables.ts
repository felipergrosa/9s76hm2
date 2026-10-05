import { QueryInterface, DataTypes } from "sequelize";

/**
 * Migration de reparo do loop de treinamento de IA.
 *
 * Contexto: `20250325000001-enhance-ai-training-improvements` é executada ANTES
 * de `20251214000002-create-ai-training-improvements` (ordem alfabética), e o
 * enhance faz ALTER COLUMN sobre ENUM sem USING — em instalações novas o par
 * quebra. Esta migration é idempotente: cria a tabela quando ausente, completa
 * colunas quando parcial, garante `status` como VARCHAR(50) e recria o índice
 * único real de AIPromptVersions (o `ai_prompt_version_unique_idx` original é
 * não-único apesar do nome).
 */

const TABLE_IMPROVEMENTS = "AITrainingImprovements";
const TABLE_VERSIONS = "AIPromptVersions";

// Definição completa conforme models/AITrainingImprovement.ts
const improvementColumns = {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  companyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: "Companies", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "CASCADE"
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  agentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stageId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  feedbackId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  improvementText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  severity: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  intentDetected: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null
  },
  verifiedInProduction: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  improvementScore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: "pending"
  },
  appliedAt: {
    type: DataTypes.DATE(6),
    allowNull: true
  },
  consolidatedPrompt: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE(6),
    allowNull: false
  },
  updatedAt: {
    type: DataTypes.DATE(6),
    allowNull: false
  }
};

const improvementIndexes: Array<{ name: string; fields: string[] }> = [
  { name: "ai_training_improvement_company_idx", fields: ["companyId"] },
  { name: "ai_training_improvement_user_idx", fields: ["userId"] },
  { name: "ai_training_improvement_agent_idx", fields: ["agentId"] },
  { name: "ai_training_improvement_stage_idx", fields: ["stageId"] },
  { name: "ai_training_improvements_category", fields: ["category"] },
  { name: "ai_training_improvements_severity", fields: ["severity"] },
  { name: "ai_training_improvements_status", fields: ["status"] }
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    let tableDef: Record<string, any> | null = null;
    try {
      tableDef = (await queryInterface.describeTable(TABLE_IMPROVEMENTS)) as any;
    } catch (_) {
      tableDef = null;
    }

    if (!tableDef) {
      await queryInterface.createTable(TABLE_IMPROVEMENTS, improvementColumns as any);
    } else {
      // Reparo parcial: colunas NOT NULL são adicionadas como nullable aqui
      // porque a tabela pode já ter linhas — a constraint forte só existe
      // no caminho de criação completa.
      for (const [column, definition] of Object.entries(improvementColumns)) {
        if (!tableDef[column]) {
          const def: any = { ...definition };
          delete def.references;
          delete def.onUpdate;
          delete def.onDelete;
          if (def.allowNull === false && column !== "id") {
            def.allowNull = true;
          }
          await queryInterface.addColumn(TABLE_IMPROVEMENTS, column, def);
        }
      }
    }

    // Garante status como VARCHAR(50) — instalações antigas podem ter a
    // coluna como ENUM, que não aceita 'rejected'/'testing'.
    try {
      const [rows]: any = await queryInterface.sequelize.query(
        `SELECT data_type FROM information_schema.columns
         WHERE table_name = '${TABLE_IMPROVEMENTS}' AND column_name = 'status'`
      );
      const dataType = String(rows?.[0]?.data_type || "").toLowerCase();
      if (dataType && dataType !== "character varying") {
        await queryInterface.sequelize.query(
          `ALTER TABLE "${TABLE_IMPROVEMENTS}"
           ALTER COLUMN "status" TYPE VARCHAR(50) USING "status"::varchar`
        );
      }
    } catch (_) {
      // Fallback para dialetos sem information_schema: tenta o cast direto;
      // se a coluna já for varchar o ALTER é no-op ou falha silenciosamente.
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE "${TABLE_IMPROVEMENTS}"
           ALTER COLUMN "status" TYPE VARCHAR(50) USING "status"::varchar`
        );
      } catch (__) {
        // Coluna já é varchar ou dialect não suporta — segue.
      }
    }

    // Índices da tabela de melhorias (apenas se ausentes)
    let existingIdx: any[] = [];
    try {
      existingIdx = (await queryInterface.showIndex(TABLE_IMPROVEMENTS)) as any[];
    } catch (_) {
      existingIdx = [];
    }
    const existingNames = new Set(existingIdx.map((i: any) => i.name));
    for (const idx of improvementIndexes) {
      if (!existingNames.has(idx.name)) {
        await queryInterface.addIndex(TABLE_IMPROVEMENTS, idx.fields, { name: idx.name });
      }
    }

    // ===== AIPromptVersions: unique index real =====
    let versionsIdx: any[] = [];
    try {
      versionsIdx = (await queryInterface.showIndex(TABLE_VERSIONS)) as any[];
    } catch (_) {
      versionsIdx = [];
    }

    const uniqueKey = "companyId,agentId,stageId,version";
    const hasRealUnique = versionsIdx.some(
      (idx: any) =>
        idx.unique &&
        Array.isArray(idx.fields) &&
        idx.fields.map((f: any) => f.attribute).join(",") === uniqueKey
    );

    if (!hasRealUnique) {
      // Deduplica (companyId, agentId, stageId, version) mantendo o menor id
      // antes de criar a constraint — caso contrário o CREATE INDEX falha.
      await queryInterface.sequelize.query(
        `DELETE FROM "${TABLE_VERSIONS}" a
         USING "${TABLE_VERSIONS}" b
         WHERE a."companyId" = b."companyId"
           AND a."agentId" = b."agentId"
           AND a."stageId" = b."stageId"
           AND a."version" = b."version"
           AND a."id" > b."id"`
      );

      const legacy = versionsIdx.find((i: any) => i.name === "ai_prompt_version_unique_idx");
      if (legacy) {
        await queryInterface.removeIndex(TABLE_VERSIONS, "ai_prompt_version_unique_idx");
      }

      await queryInterface.addIndex(
        TABLE_VERSIONS,
        ["companyId", "agentId", "stageId", "version"],
        { name: "ai_prompt_version_unique_idx", unique: true }
      );
    }
  },

  down: async () => {
    // No-op intencional: esta migration apenas repara schema para o estado
    // esperado pelos models (não adiciona estrutura nova que precise de
    // rollback — remover colunas/constraint poderia corromper dados já
    // gravados no formato reparado).
  }
};
