export interface UserRecord {
	id: number;
	name: string;
	email: string;
}

export class UserRepository {
	public async save(data: { name: string; email: string }): Promise<UserRecord> {
		return {
			id: 1,
			name: data.name,
			email: data.email,
		};
	}

	public async findAll(): Promise<UserRecord[]> {
		return [{ id: 1, name: 'Ada Lovelace', email: 'ada@example.com' }];
	}
}

export const userRepository = new UserRepository();
