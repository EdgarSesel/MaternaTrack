/**
 * Standard filter to exclude soft-deleted records.
 * Add to `where` clause on Patient, CarePlan, CareTask, Message queries.
 */
export const notDeleted = { deletedAt: null } as const;
