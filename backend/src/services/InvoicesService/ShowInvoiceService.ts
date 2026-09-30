import Invoice from "../../models/Invoices";
import AppError from "../../errors/AppError";

const ShowInvoceService = async (Invoiceid: string | number, companyId?: number): Promise<Invoice> => {
  // Quando companyId é informado, a fatura precisa pertencer à empresa (anti cross-tenant)
  const where: any = { id: Invoiceid };
  if (companyId !== undefined) {
    where.companyId = companyId;
  }

  const invoice = await Invoice.findOne({ where });

  if (!invoice) {
    throw new AppError("ERR_NO_INVOICE_FOUND", 404);
  }

  return invoice;
};

export default ShowInvoceService;
