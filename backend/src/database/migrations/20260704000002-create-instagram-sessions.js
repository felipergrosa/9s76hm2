"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("InstagramSessions", {
      id:          { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      companyId:   { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: "Companies", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      username:    { type: Sequelize.STRING, allowNull: true },
      cookies:     { type: Sequelize.JSON, defaultValue: [] },
      status:      { type: Sequelize.STRING(20), defaultValue: "active" },
      lastLoginAt: { type: Sequelize.DATE, allowNull: true },
      lastUsedAt:  { type: Sequelize.DATE, allowNull: true },
      createdAt:   { type: Sequelize.DATE, allowNull: false },
      updatedAt:   { type: Sequelize.DATE, allowNull: false },
    });
  },
  down: async (queryInterface) => queryInterface.dropTable("InstagramSessions"),
};
