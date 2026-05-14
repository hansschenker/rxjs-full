export interface Todo {
	id: string;
	title: string;
	completed: boolean;
	createdAt: string;
}

export interface CreateTodoBody {
	title: string;
}

export interface UpdateTodoBody {
	title?: string;
	completed?: boolean;
}
