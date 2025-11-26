import {
    Table,
    Column,
    CreatedAt,
    UpdatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo,
    DataType,
    Default
} from "sequelize-typescript";
import LibraryFolder from "./LibraryFolder";
import FilesOptions from "./FilesOptions";
import KnowledgeDocument from "./KnowledgeDocument";

export enum LibraryFileStatus {
    PENDING = "pending",
    INDEXING = "indexing",
    INDEXED = "indexed",
    FAILED = "failed"
}

@Table({
    tableName: "LibraryFiles"
})
class LibraryFile extends Model<LibraryFile> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => LibraryFolder)
    @Column
    folderId: number;

    @BelongsTo(() => LibraryFolder)
    folder: LibraryFolder;

    @ForeignKey(() => FilesOptions)
    @Column
    fileOptionId: number;

    @BelongsTo(() => FilesOptions)
    fileOption: FilesOptions;

    @Column
    title: string;

    @Column(DataType.TEXT)
    get tags(): string[] {
        const tags = this.getDataValue("tags");
        if (!tags) return [];
        try {
            return JSON.parse(tags as any);
        } catch {
            return [];
        }
    }

    set tags(value: string[]) {
        this.setDataValue("tags", JSON.stringify(value) as any);
    }

    @Default(LibraryFileStatus.PENDING)
    @Column(DataType.ENUM(...Object.values(LibraryFileStatus)))
    statusRag: LibraryFileStatus;

    @Column
    lastIndexedAt: Date;

    @ForeignKey(() => KnowledgeDocument)
    @Column
    knowledgeDocumentId: number;

    @BelongsTo(() => KnowledgeDocument)
    knowledgeDocument: KnowledgeDocument;

    @Column(DataType.TEXT)
    errorMessage: string;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default LibraryFile;
