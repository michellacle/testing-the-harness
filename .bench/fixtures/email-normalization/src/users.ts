export interface User {
  id: string;
  email: string;
}

export function createUser(id: string, email: string): User {
  return { id, email };
}
