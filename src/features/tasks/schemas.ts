import { z } from "zod";
import { itemTitleSchema, optionalDaySchema } from "@/features/goals/schemas";

export const taskFormSchema = z.object({
  title: itemTitleSchema,
  dueDate: optionalDaySchema,
});
