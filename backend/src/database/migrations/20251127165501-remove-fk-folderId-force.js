module.exports = {
    up: (queryInterface) => {
        return queryInterface.removeConstraint("Queues", "Queues_folderId_fkey");
    },

    down: (queryInterface) => {
        return queryInterface.addConstraint("Queues", ["folderId"], {
            type: "foreign key",
            name: "Queues_folderId_fkey",
            references: {
                table: "LibraryFolders",
                field: "id"
            },
            onDelete: "SET NULL",
            onUpdate: "CASCADE"
        });
    }
};
