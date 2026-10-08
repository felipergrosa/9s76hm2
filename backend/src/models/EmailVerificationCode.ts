import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement
} from "sequelize-typescript";

/**
 * Código de verificação de e-mail (6 dígitos) do fluxo de signup.
 * SEGURANÇA: `codeHash` guarda apenas o SHA-256 do código — o valor em claro
 * nunca é persistido nem logado. `verifiedToken` é o token opaco de uso único
 * exigido no /auth/signup após a verificação bem-sucedida.
 */
@Table({ tableName: "EmailVerificationCodes" })
class EmailVerificationCode extends Model<EmailVerificationCode> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // E-mail normalizado (lowercase) que recebeu o código
  @Column
  email: string;

  // SHA-256(email + ":" + código) — nunca armazenar o código em claro
  @Column
  codeHash: string;

  // Tentativas de verificação deste código (máx. 5 no service)
  @Column({ defaultValue: 0 })
  attempts: number;

  // Validade do código (15 min após envio)
  @Column
  expiresAt: Date;

  // Token opaco gerado após verificação; exigido no signup
  @Column
  verifiedToken: string;

  // Validade do verifiedToken (30 min após a verificação)
  @Column
  verifiedTokenExpiresAt: Date;

  // Marca de uso único — preenchido quando o signup consome o token
  @Column
  consumedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default EmailVerificationCode;
