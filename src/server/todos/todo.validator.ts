import * as t from 'io-ts';

export const CreateTodoCodec = t.type({ title: t.string });
export const UpdateTodoCodec = t.partial({ title: t.string, completed: t.boolean });

export type CreateTodoInput = t.TypeOf<typeof CreateTodoCodec>;
export type UpdateTodoInput = t.TypeOf<typeof UpdateTodoCodec>;
