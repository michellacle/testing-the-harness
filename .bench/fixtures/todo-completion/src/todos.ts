export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function addTodo(todos: Todo[], id: string, title: string): Todo[] {
  return [...todos, { id, title, completed: false }];
}
