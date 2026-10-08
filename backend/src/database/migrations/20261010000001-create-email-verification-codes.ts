import { QueryInterface, DataTypes } from "sequelize";

// Tabela dedicada aos códigos de verificação de e-mail (6 dígitos) usados
// no fluxo de signup. Guarda apenas o HASH do código — nunca o valor em
// claro — além de controle de tentativas, expiração e token pós-verificação.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "EmailVerificationCodes";

    const tableInfo: any = await queryInterface.showAllTables();
    if (Array.isArray(tableInfo) && tableInfo.map(String).includes(table)) {
      return;
    }

    await queryInterface.createTable(table, {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      // E-mail normalizado (lowercase) que recebeu o código
      email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // SHA-256 do código de 6 dígitos — o código nunca é persistido em claro
      codeHash: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Tentativas de verificação deste código (máx. 5, enforced no service)
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      // Validade do código (15 min a partir do envio)
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      // Token opaco gerado após verificação bem-sucedida; exigido no signup
      verifiedToken: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Validade do verifiedToken (30 min após a verificação)
      verifiedTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      // Preenchido quando o token é consumido pelo signup (uso único)
      consumedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Lookup por e-mail (verificação, cooldown e rate-limit por janela)
    await queryInterface.addIndex(table, ["email"], {
      name: "email_verification_codes_email_idx"
    });

    // Lookup do token pós-verificação consumido no signup (único; NULLs permitidos)
    await queryInterface.addIndex(table, ["verifiedToken"], {
      name: "email_verification_codes_token_idx",
      unique: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("EmailVerificationCodes");
  }
};
