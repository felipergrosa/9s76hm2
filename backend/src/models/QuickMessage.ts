import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  AutoIncrement,
  DataType
} from "sequelize-typescript";

import Company from "./Company";
import User from "./User";

@Table
class QuickMessage extends Model<QuickMessage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  shortcode: string;

  @Column
  message: string;

  @Column(DataType.TEXT)
  get mediaPath(): any {
    const value = this.getDataValue("mediaPath");
    if (value) {
      const baseUrl = `${process.env.BACKEND_URL}${process.env.PROXY_PORT ? `:${process.env.PROXY_PORT}` : ""}/public/company${this.companyId}/quickMessage/`;
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map(file => {
            if (file && (file.startsWith("http") || file.startsWith("base64"))) {
              return file;
            }
            return `${baseUrl}${file}`;
          });
        }
      } catch (e) {
        if (value && (value.startsWith("http") || value.startsWith("base64"))) {
          return value;
        }
        return `${baseUrl}${value}`;
      }
    }
    return null;
  }

  set mediaPath(value: any) {
    if (Array.isArray(value)) {
      const filenames = value.map(val => {
        if (typeof val === "string" && val.includes("/public/company")) {
          return val.split("/").pop();
        }
        return val;
      });
      this.setDataValue("mediaPath", JSON.stringify(filenames));
    } else if (typeof value === "string") {
      const trimmedValue = value.trim();

      if (trimmedValue.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmedValue);
          if (Array.isArray(parsed)) {
            const filenames = parsed.map(val => {
              if (typeof val === "string" && val.includes("/public/company")) {
                return val.split("/").pop();
              }
              return val;
            });
            this.setDataValue("mediaPath", JSON.stringify(filenames));
            return;
          }
        } catch (error) {
          // Fallback para compatibilidade com valores legados malformados.
        }
      }

      if (trimmedValue.includes(",")) {
        const filenames = value.split(",").map(val => {
          const trimmed = val.trim();
          if (trimmed.includes("/public/company")) {
            return trimmed.split("/").pop();
          }
          return trimmed;
        });
        this.setDataValue("mediaPath", JSON.stringify(filenames));
      } else if (value.includes("/public/company")) {
        this.setDataValue("mediaPath", value.split("/").pop());
      } else {
        this.setDataValue("mediaPath", value);
      }
    } else {
      this.setDataValue("mediaPath", value);
    }
  }


  
  @Column(DataType.TEXT)
  mediaName: string;

  @Column
  geral: boolean;
  
  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsTo(() => User)
  user: User;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @Column
  visao: boolean;

  @Column
  groupName: string;

  @Column
  color: string;

  @Column
  useCount: number;

  @Column({ defaultValue: 0 })
  delay: number;

  @Column({ defaultValue: true })
  sendAsCaption: boolean;

  @Column(DataType.TEXT)
  flow: string;
}

export default QuickMessage;
