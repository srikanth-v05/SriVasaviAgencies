import { Prisma } from "@prisma/client";
import type { PrismaTransaction } from "../db/prisma";
import { financialYearOf } from "../utils/fiscal-year";

export type DocumentKind = "QUOTATION" | "INVOICE";

/**
 * Document numbering (architecture.md §17).
 *
 * Allocation is one locked write:
 *
 *   UPDATE document_sequences
 *   SET nextNumber = LAST_INSERT_ID(nextNumber) + 1
 *   WHERE kind = ? AND financialYear = ?
 *
 * `LAST_INSERT_ID(expr)` stores `expr` on the connection and returns it from the
 * following `SELECT LAST_INSERT_ID()`. So the statement hands back the number it
 * consumed while incrementing the counter, atomically, holding the row lock for
 * exactly one statement. Two concurrent finalisations serialise on that lock and
 * can never receive the same number.
 *
 * `LAST_INSERT_ID()` is connection-scoped, and a Prisma interactive transaction
 * pins one connection, so the read always sees this transaction's own value.
 *
 * The counter row is created lazily — once per document kind per financial year.
 * That insert is the only place two sessions can collide, and the collision is
 * resolved by re-running the update.
 *
 * Everything runs inside the caller's transaction: if invoice creation later
 * fails, the consumed number rolls back with it.
 */
export class NumberingService {
  async allocate(
    tx: PrismaTransaction,
    kind: DocumentKind,
    prefix: string,
    documentDate: Date,
  ): Promise<{ number: string; sequence: number; financialYear: string }> {
    const financialYear = financialYearOf(documentDate);
    // `kind` is a closed union, never user input, so interpolating it is safe.
    const kindLiteral = Prisma.raw(`'${kind}'`);

    let updated = await this.bump(tx, kindLiteral, financialYear, prefix);

    if (updated === 0) {
      // First document of this kind this financial year. If another session wins
      // the insert, the duplicate key is ignored and the bump below picks up its row.
      await tx.$executeRaw`
        INSERT INTO document_sequences (id, kind, financialYear, prefix, nextNumber, padding, updatedAt)
        VALUES (UUID(), ${kindLiteral}, ${financialYear}, ${prefix}, 1, 4, NOW(3))
        ON DUPLICATE KEY UPDATE id = id
      `;
      updated = await this.bump(tx, kindLiteral, financialYear, prefix);
      if (updated === 0) throw new Error("Failed to allocate a document number");
    }

    const [row] = await tx.$queryRaw<{ allocated: bigint | number }[]>`SELECT LAST_INSERT_ID() AS allocated`;
    const sequence = Number(row?.allocated ?? 0);
    if (!sequence) throw new Error("Failed to read back the allocated document number");

    const padding = await this.paddingFor(tx, kind, financialYear);
    return {
      number: `${prefix}/${financialYear}/${String(sequence).padStart(padding, "0")}`,
      sequence,
      financialYear,
    };
  }

  /** The single locked write. Returns how many rows it touched. */
  private bump(
    tx: PrismaTransaction,
    kindLiteral: Prisma.Sql,
    financialYear: string,
    prefix: string,
  ): Promise<number> {
    return tx.$executeRaw`
      UPDATE document_sequences
      SET nextNumber = LAST_INSERT_ID(nextNumber) + 1,
          prefix = ${prefix},
          updatedAt = NOW(3)
      WHERE kind = ${kindLiteral} AND financialYear = ${financialYear}
    `;
  }

  private async paddingFor(tx: PrismaTransaction, kind: DocumentKind, financialYear: string): Promise<number> {
    const row = await tx.documentSequence.findUnique({
      where: { kind_financialYear: { kind, financialYear } },
      select: { padding: true },
    });
    return row?.padding ?? 4;
  }

  /** Preview the next number without consuming it — for UI display only. */
  async peek(tx: PrismaTransaction, kind: DocumentKind, prefix: string, documentDate: Date): Promise<string> {
    const financialYear = financialYearOf(documentDate);
    const existing = await tx.documentSequence.findUnique({
      where: { kind_financialYear: { kind, financialYear } },
    });
    const sequence = existing?.nextNumber ?? 1;
    const padded = String(sequence).padStart(existing?.padding ?? 4, "0");
    return `${prefix}/${financialYear}/${padded}`;
  }
}
