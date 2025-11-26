import {
    Table,
    Column,
    CreatedAt,
    Model,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo,
    DataType,
    Default
} from "sequelize-typescript";
import Queue from "./Queue";
import LibraryFolder from "./LibraryFolder";

export enum QueueRAGSourceMode {
    INCLUDE = "include",
    EXCLUDE = "exclude"
}

@Table({
    tableName: "QueueRAGSources",
    updatedAt: false
})
class QueueRAGSource extends Model<QueueRAGSource> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @ForeignKey(() => Queue)
    @Column
    queueId: number;

    @BelongsTo(() => Queue)
    queue: Queue;

    @ForeignKey(() => LibraryFolder)
    @Column
    folderId: number;

    @BelongsTo(() => LibraryFolder)
    folder: LibraryFolder;

    @Default(QueueRAGSourceMode.INCLUDE)
    @Column(DataType.ENUM(...Object.values(QueueRAGSourceMode)))
    mode: QueueRAGSourceMode;

    @Default(1.0)
    @Column(DataType.FLOAT)
    weight: number;

    @CreatedAt
    createdAt: Date;
}

export default QueueRAGSource;
