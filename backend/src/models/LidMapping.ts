import {
    Table,
    Column,
    Model,
    DataType,
    PrimaryKey,
    AutoIncrement,
    ForeignKey,
    BelongsTo,
    CreatedAt,
    UpdatedAt,
    Index
} from "sequelize-typescript";
import Company from "./Company";
import Whatsapp from "./Whatsapp";

/**
 * Tabela para armazenar mapeamentos LID -> Número de telefone
 * 
 * O WhatsApp usa LIDs (Linked Device IDs) como identificadores de privacidade.
 * Esta tabela persiste os mapeamentos descobertos para evitar duplicação de contatos.
 */
@Table({
    tableName: "LidMappings",
    timestamps: true,
    indexes: [
        { fields: ["lid", "companyId"], unique: true },
        { fields: ["phoneNumber", "companyId"] }
    ]
})
class LidMapping extends Model<LidMapping> {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number;

    @Column({
        type: DataType.STRING,
        allowNull: false,
        comment: "LID do WhatsApp (ex: 247540473708749@lid)"
    })
    lid: string;

    @Column({
        type: DataType.STRING,
        allowNull: false,
        comment: "Número de telefone real (ex: 5519987054278)"
    })
    phoneNumber: string;

    @Column({
        type: DataType.STRING(100),
        allowNull: true,
        comment: "Origem do mapeamento (ex: baileys_lid_mapping_event, baileys_signal_repository)"
    })
    source: string;

    @Column({
        type: DataType.FLOAT,
        allowNull: true,
        comment: "Nível de confiança do mapeamento (0.0 a 1.0)"
    })
    confidence: number;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: "Se o mapeamento foi verificado pelo evento lid-mapping.update do Baileys"
    })
    verified: boolean;

    @ForeignKey(() => Company)
    @Column({
        type: DataType.INTEGER,
        allowNull: false
    })
    companyId: number;

    @BelongsTo(() => Company)
    company: Company;

    @ForeignKey(() => Whatsapp)
    @Column({
        type: DataType.INTEGER,
        allowNull: true
    })
    whatsappId: number;

    @BelongsTo(() => Whatsapp)
    whatsapp: Whatsapp;

    @CreatedAt
    createdAt: Date;

    @UpdatedAt
    updatedAt: Date;
}

export default LidMapping;
