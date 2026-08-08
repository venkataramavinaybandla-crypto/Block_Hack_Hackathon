import { handle } from 'hono/vercel';
import app from '../x402-server/index';

export default handle(app);
