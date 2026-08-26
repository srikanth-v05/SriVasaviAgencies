import { EnquiryRepository } from "../repositories/enquiry.repository";
import { logger } from "../config/logger";

export interface EnquiryInput {
  name: string;
  organisation?: string | null;
  phone: string;
  email?: string | null;
  message: string;
  productIds?: string[];
}

/** Bulk-order enquiries from the public website. */
export class EnquiryService {
  constructor(private enquiryRepository: EnquiryRepository) {}

  async create(input: EnquiryInput) {
    const enquiry = await this.enquiryRepository.create({
      name: input.name,
      organisation: input.organisation ?? null,
      phone: input.phone,
      email: input.email ?? null,
      message: input.message,
      // Json column: MySQL has no array type.
      productIds: input.productIds ?? [],
    });
    logger.info({ enquiryId: enquiry.id }, "New bulk-order enquiry received");
    return enquiry;
  }

  list(params: { isHandled?: boolean; skip: number; take: number }) {
    return this.enquiryRepository.list(params);
  }

  markHandled(id: string, isHandled: boolean) {
    return this.enquiryRepository.markHandled(id, isHandled);
  }
}
