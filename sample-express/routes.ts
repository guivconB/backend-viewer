import { userController } from './user.controller';

const router = {
	get: (_path: string, _handler: (...args: any[]) => any) => {},
	post: (_path: string, _handler: (...args: any[]) => any) => {},
};

// TESTE AQUI: Posicione o cursor em "create" ou "index" abaixo,
// clique com o botão direito e escolha "Backend Viewer: Rastrear Símbolo sob o Cursor"
router.post('/users', userController.create);
router.get('/users', userController.index);
