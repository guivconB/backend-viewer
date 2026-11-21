import { userService } from './user.service';

export class UserController {
	public async create(req: { body: { name: string; email: string } }, res: { json: (data: unknown) => unknown }) {
		// Posicione o cursor em "createUser" abaixo e execute o comando para ir ao Service
		const user = await userService.createUser(req.body);
		return res.json(user);
	}

	public async index(_req: unknown, res: { json: (data: unknown) => unknown }) {
		const users = await userService.listUsers();
		return res.json(users);
	}
}

export const userController = new UserController();
