import { h } from '../h';
import type { Todo } from '../../shared/types';

interface Props {
	todo: Todo;
	onToggle: () => void;
	onDelete: () => void;
}

export const TodoItem = ({ todo, onToggle, onDelete }: Props): HTMLElement => (
	<li className={todo.completed ? 'completed' : undefined}>
		<input type="checkbox" checked={todo.completed} onChange={onToggle} />
		<span>{todo.title}</span>
		<button onClick={onDelete}>Delete</button>
	</li>
);
