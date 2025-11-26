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
    HasMany,
    DataType,
    Default
} from "sequelize-typescript";
import Company from "./Company";
import LibraryFile from "./LibraryFile";
import QueueRAGSource from "./QueueRAGSource";

@Table({
    tableName: "LibraryFolders"
})
class LibraryFolder extends Model<LibraryFolder> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Company)
    @Column
    companyId: number;

    @BelongsTo(() => Company)
    company: Company;

    @Column
    name: string;

    @ForeignKey(() => LibraryFolder)
    @Column
    parentId: number;

    @BelongsTo(() => LibraryFolder, "parentId")
    parent: LibraryFolder;

    @HasMany(() => LibraryFolder, "parentId")
    children: LibraryFolder[];

    @Column(DataType.TEXT)
    description: string;

    @Column
    slug: string;

    @Column(DataType.TEXT)
    get defaultTags(): string[] {
        const tags = this.getDataValue("defaultTags");
        if (!tags) return [];
        try {
            return JSON.parse(tags as any);
        } catch {
            return [];
        }
    }

    set defaultTags(value: string[]) {
        this.setDataValue("defaultTags", JSON.stringify(value) as any);
    }

    @Default("pt-BR")
    @Column
    defaultLanguage: string;

    @Default(5)
    @Column
    ragPriority: number;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;

    @HasMany(() => LibraryFile)
    files: LibraryFile[];

    @HasMany(() => QueueRAGSource)
    queueSources: QueueRAGSource[];
}

export default LibraryFolder;
