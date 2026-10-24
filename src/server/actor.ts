import type { Role } from "@/generated/prisma/enums";

/** The authenticated user a service call is made on behalf of. */
export type Actor = { id: string; role: Role; name: string; email: string; profileCompleted: boolean };
