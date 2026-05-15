import { z } from 'zod';
import type { RouteParams } from '../../shared/routes';
import { routes } from '../../shared/routes';

export const CreateTodoSchema = z.object({ title: z.string().min(1) });
export const UpdateTodoSchema = z.object({
	title: z.string().min(1).optional(),
	completed: z.boolean().optional(),
});
export const TodoParamsSchema = z.object({ id: z.string().min(1) });

export type CreateTodoInput = z.infer<typeof CreateTodoSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;
export type TodoParams = RouteParams<typeof routes.todos.update.path>;
