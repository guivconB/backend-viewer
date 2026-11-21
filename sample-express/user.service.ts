import { userRepository } from './user.repository';

export class UserService {
	public async createUser(payload: { name: string; email: string }) {
		// Posicione o cursor em "save" abaixo e execute o comando para ir ao Repository
		const created = await userRepository.save(payload);
		return created;
	}

	public async listUsers() {
		return await userRepository.findAll();
	}
}

export const userService = new UserService();
